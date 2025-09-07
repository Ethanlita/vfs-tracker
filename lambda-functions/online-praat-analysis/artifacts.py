import logging
from io import BytesIO
import matplotlib.pyplot as plt
from matplotlib.ticker import ScalarFormatter
import numpy as np
import librosa
import parselmouth
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from datetime import datetime, timezone
import json
import boto3
from reportlab.lib.utils import ImageReader
# 新增：更优排版支持
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
import matplotlib.font_manager as fm

# Table row background colors (subtle pastels)
LIGHT_PINK = colors.HexColor("#fdf2f8")
LIGHT_GRAY = colors.HexColor("#f9fafb")

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# --- Font Configuration ---
_CJK_FONT_NAME = 'NotoSansSC'
_EN_FONT_NAME = 'Roboto'
_FALLBACK_FONT_NAME = 'Helvetica'
_CJK_FONT_REGISTERED = False
_EN_FONT_REGISTERED = False

# 假设字体文件与此脚本位于同一目录或Lambda层中
# 在部署时，确保 'NotoSansSC-Regular.ttf' 文件存在
font_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'NotoSansSC-Regular.ttf')
en_font_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'Roboto-Regular.ttf')

if not os.path.exists(font_path):
    # 如果在当前目录找不到，尝试在根目录或通用字体目录查找
    # 这是为了适应不同的Lambda部署结构
    possible_paths = [
        '/var/task/NotoSansSC-Regular.ttf',
        os.path.join(os.path.dirname(__file__), 'NotoSansSC-Regular.ttf')
    ]
    for p in possible_paths:
        if os.path.exists(p):
            font_path = p
            break

try:
    if os.path.exists(font_path):
        # 为 ReportLab 注册中文字体
        pdfmetrics.registerFont(TTFont(_CJK_FONT_NAME, font_path))
        # 为 Matplotlib 注册中文字体
        fm.fontManager.addfont(font_path)
        _CJK_FONT_REGISTERED = True
        _FONT = _CJK_FONT_NAME
        logger.info(
            f"Successfully registered CJK font '{_CJK_FONT_NAME}' from path: {font_path}"
        )
    else:
        _FONT = _FALLBACK_FONT_NAME
        logger.warning(
            f"Font file not found at expected paths. Using fallback font '{_FONT}'. CJK characters may not render."
        )

    # 注册英文 Roboto 字体以改善字距
    if os.path.exists(en_font_path):
        pdfmetrics.registerFont(TTFont(_EN_FONT_NAME, en_font_path))
        fm.fontManager.addfont(en_font_path)
        _EN_FONT_REGISTERED = True
        logger.info(
            f"Successfully registered English font '{_EN_FONT_NAME}' from path: {en_font_path}"
        )
    else:
        logger.warning(
            f"Roboto font not found at {en_font_path}; using default sans-serif for English text."
        )

    # Matplotlib 全局字体配置: 先英文 Roboto 再中文 NotoSansSC
    plt.rcParams['font.family'] = 'sans-serif'
    plt.rcParams['font.sans-serif'] = [_EN_FONT_NAME, _CJK_FONT_NAME, 'sans-serif']
    plt.rcParams['axes.unicode_minus'] = False  # 正确显示负号

except Exception as e:
    _FONT = _FALLBACK_FONT_NAME
    logger.error(
        f"Failed to register fonts. Error: {e}. Using fallback font '{_FONT}'."
    )

# 统一的 Matplotlib 字体属性（若可用）


def _bilingual(text: str) -> str:
    """Return HTML-styled bilingual text using Roboto for English and
    the configured CJK font for Chinese. If no separator is found, the
    whole text is treated as English.  The function expects strings
    formatted like "English / 中文"."""
    parts = text.split('/', 1)
    if len(parts) == 2:
        en, zh = parts[0].strip(), parts[1].strip()
        return (
            f'<font name="{_EN_FONT_NAME}">{en}</font> / '
            f'<font name="{_FONT}">{zh}</font>'
        )
    return f'<font name="{_EN_FONT_NAME}">{text}</font>'


def create_placeholder_chart(title: str, message: str):
    """Creates a placeholder chart with a title and a message.
    明确指定字体，避免中文不显示。
    """
    logger.info(f"Creating placeholder chart: {title}")
    try:
        fig, ax = plt.subplots(figsize=(10, 6))
        # 标题与主体文字使用 rcParams 字体 (Roboto + NotoSansSC)
        ax.set_title(title)
        ax.text(
            0.5,
            0.5,
            message,
            ha='center',
            va='center',
            fontsize=12,
            color='gray',
            wrap=True,
        )
        ax.set_xticks([])
        ax.set_yticks([])
        for sp in ('top','right','bottom','left'):
            ax.spines[sp].set_visible(False)
        fig.tight_layout()
        buf = BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        plt.close(fig)
        return buf
    except Exception as e:
        logger.error(f"Could not create placeholder chart for {title}. Error: {e}")
        return None


def create_time_series_chart(file_path, f0min=75, f0max=600):
    """
    Creates a time series chart with waveform and F0 contour.

    Args:
        file_path (str): The local path to the .wav file.
        f0min (int): Minimum pitch frequency.
        f0max (int): Maximum pitch frequency.

    Returns:
        BytesIO: A BytesIO object containing the PNG image of the chart.
                 Returns None if chart generation fails.
    """
    logger.info(f"Creating time series chart for {file_path}")
    try:
        # Load audio data
        y, sr = librosa.load(file_path, sr=None)
        sound = parselmouth.Sound(file_path)
        pitch = sound.to_pitch(pitch_floor=f0min, pitch_ceiling=f0max)
        pitch_values = pitch.selected_array['frequency']
        pitch_values[pitch_values == 0] = np.nan # Replace 0s with NaN for plotting
        
        # Create plot
        fig, ax1 = plt.subplots(figsize=(10, 4))
        
        # Plot waveform
        time = np.linspace(0, len(y) / sr, num=len(y))
        ax1.plot(time, y, color='#8e44ad', alpha=0.6, label='Waveform')
        ax1.set_xlabel("Time (s)")
        ax1.set_ylabel("Amplitude", color='#8e44ad')
        ax1.tick_params(axis='y', labelcolor='#8e44ad')
        # 根据实际波形动态调整纵轴，避免误导性的衰减外观
        peak = np.max(np.abs(y)) or 1
        ax1.set_ylim([-peak, peak])
        ax1.grid(True, linestyle='--', alpha=0.6)

        # Plot F0 on a second y-axis
        ax2 = ax1.twinx()
        pitch_time = np.linspace(0, sound.get_total_duration(), num=len(pitch_values))
        ax2.plot(pitch_time, pitch_values, color='#e74c3c', linewidth=2, label='Fundamental Frequency (F0)')
        ax2.set_ylabel("Frequency (Hz)", color='#e74c3c')
        ax2.tick_params(axis='y', labelcolor='#e74c3c')
        ax2.yaxis.set_major_formatter(ScalarFormatter()) # Disable scientific notation
        ax2.set_ylim([f0min, f0max])

        plt.title("Waveform and F0 Time Series")
        fig.tight_layout()
        
        # Save to a BytesIO object
        buf = BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        plt.close(fig)
        
        logger.info(f"Successfully created time series chart for {file_path}")
        return buf

    except Exception as e:
        logger.error(f"Could not create time series chart for {file_path}. Error: {e}")
        return create_placeholder_chart('Time Series Waveform & F0', 'Chart generation failed.')


def create_vrp_chart(data):
    """创建真实(基础版) VRP 图。
    参数 data 需包含键: bins(list[{f0_center_hz,spl_min,spl_max,spl_mean}])。
    若数据不足则返回占位图。
    """
    logger.info("Creating VRP chart (enhanced)")
    try:
        bins = data.get('bins') if isinstance(data, dict) else None
        if not bins:
            raise ValueError('No bins for VRP')
        freqs = [b['f0_center_hz'] for b in bins]
        spl_min = [b['spl_min'] for b in bins]
        spl_max = [b['spl_max'] for b in bins]
        spl_mean = [b['spl_mean'] for b in bins]
        fig, ax = plt.subplots(figsize=(8,5))
        ax.fill_between(freqs, spl_min, spl_max, color='#c9e6ff', alpha=0.6, label='Range (min-max)')
        ax.plot(freqs, spl_mean, color='#0077cc', linewidth=2, label='Mean SPL')
        # 使用线性坐标并显示具体数值刻度
        ax.set_xlim(min(freqs), max(freqs))
        ax.xaxis.set_major_formatter(ScalarFormatter())
        # 增加横轴刻度密度，便于读取不同频率点
        ax.set_xticks(np.linspace(min(freqs), max(freqs), num=10))
        ax.set_xlabel('Frequency (Hz)')
        ax.set_ylabel('SPL dB(A) (est)')
        ax.set_title('Voice Range Profile')
        ax.grid(True, linestyle='--', alpha=0.4)
        ax.legend()
        buf = BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format='png')
        buf.seek(0)
        plt.close(fig)
        return buf
    except Exception as e:
        logger.error(f'create_vrp_chart failed, fallback placeholder: {e}')
        return create_placeholder_chart('Voice Range Profile', 'VRP Data Unavailable')


def create_formant_chart(formant_low, formant_high):
    """Creates an F1-F2 vowel space chart."""
    logger.info("Creating F1-F2 Vowel Space chart")
    try:
        fig, ax = plt.subplots(figsize=(8, 6))

        # Plot points
        ax.plot(formant_low['F2'], formant_low['F1'], 'o', markersize=10, color='blue', label='Lowest Note')
        ax.plot(formant_high['F2'], formant_high['F1'], 'o', markersize=10, color='red', label='Highest Note')

        # Annotate points
        ax.text(formant_low['F2'] + 20, formant_low['F1'], 'Low')
        ax.text(formant_high['F2'] + 20, formant_high['F1'], 'High')

        # Standard F1-F2 chart conventions
        ax.set_xlabel('F2 (Hz)')
        ax.set_ylabel('F1 (Hz)')
        ax.set_title('F1-F2 Vowel Space')
        ax.xaxis.set_major_formatter(ScalarFormatter()) # Disable scientific notation
        ax.yaxis.set_major_formatter(ScalarFormatter()) # Disable scientific notation
        ax.invert_xaxis()
        ax.invert_yaxis()
        ax.grid(True, linestyle='--', alpha=0.6)
        ax.legend()

        buf = BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format='png')
        buf.seek(0)
        plt.close(fig)
        return buf
    except Exception as e:
        logger.error(f"Could not create formant chart. Error: {e}")
        return create_placeholder_chart('F1-F2 Vowel Space', 'Formant data incomplete.')


def create_formant_spl_chart(spectrum_low, spectrum_high):
    """Creates a Formant-SPL (LPC Spectrum) chart."""
    logger.info("Creating Formant-SPL Spectrum chart")
    try:
        fig, ax = plt.subplots(figsize=(10, 6))

        # Plot spectrum for the lowest note
        if spectrum_low and 'frequencies' in spectrum_low and 'spl_values' in spectrum_low:
            ax.plot(spectrum_low['frequencies'], spectrum_low['spl_values'], color='blue', label='Lowest Note Spectrum')

        # Plot spectrum for the highest note
        if spectrum_high and 'frequencies' in spectrum_high and 'spl_values' in spectrum_high:
            ax.plot(spectrum_high['frequencies'], spectrum_high['spl_values'], color='red', label='Highest Note Spectrum')

        ax.set_xlabel('Frequency (Hz)')
        ax.set_ylabel('SPL (dB)')
        ax.set_title('Formant-SPL Spectrum (LPC)')
        ax.set_xlim(0, 5500)
        # 增加更多刻度，便于用户读取共振峰位置
        ax.set_xticks(np.arange(0, 5501, 500))
        ax.xaxis.set_major_formatter(ScalarFormatter())
        # y 轴刻度以 10 dB 为间隔
        ymin, ymax = ax.get_ylim()
        ax.set_yticks(np.arange(int(ymin // 10 * 10), int(ymax // 10 * 10 + 20), 10))
        ax.grid(True, linestyle='--', alpha=0.6)
        ax.legend()

        buf = BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format='png')
        buf.seek(0)
        plt.close(fig)
        return buf
    except Exception as e:
        logger.error(f"Could not create formant-SPL chart. Error: {e}")
        return create_placeholder_chart('Formant-SPL Spectrum (LPC)', 'Spectrum data unavailable.')


def create_pdf_report(session_id, metrics, chart_urls, userInfo=None):
    """
    Generates a PDF report from the analysis results with embedded charts and user info.

    Args:
        session_id (str): The session ID for the report.
        metrics (dict): The dictionary of calculated metrics.
        chart_urls (dict): A dictionary of S3 URLs for the generated charts.
        userInfo (dict): A dictionary containing user information (userId, userName).

    Returns:
        BytesIO: A BytesIO object containing the PDF.
    """
    logger.info(f"Creating PDF report for session {session_id}")
    if userInfo is None:
        userInfo = {}

    try:
        # 文档与样式
        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=letter,
            leftMargin=0.5 * inch,
            rightMargin=0.5 * inch,
            topMargin=0.5 * inch,
            bottomMargin=0.5 * inch,
        )
        styles = getSampleStyleSheet()
        # 基础样式
        title_style = ParagraphStyle(
            'TitleCnEn',
            parent=styles['Title'],
            alignment=TA_CENTER,
            fontName=_FONT,
            fontSize=20,
            leading=24,
            spaceAfter=6,
        )
        subtitle_style = ParagraphStyle(
            'Subtitle', parent=styles['Normal'], alignment=TA_CENTER, fontName=_FONT, fontSize=10, leading=14
        )
        h1_style = ParagraphStyle(
            'H1', parent=styles['Heading1'], fontName=_FONT, fontSize=14, leading=18, spaceBefore=6, spaceAfter=4
        )
        h2_style = ParagraphStyle(
            'H2', parent=styles['Heading2'], fontName=_FONT, fontSize=12, leading=16, spaceBefore=4, spaceAfter=2
        )
        text_style = ParagraphStyle(
            'Body', parent=styles['Normal'], fontName=_FONT, fontSize=10, leading=14
        )
        small_style = ParagraphStyle(
            'Small', parent=styles['Normal'], fontName=_FONT, fontSize=8, leading=11, textColor=colors.grey
        )

        def on_page(canv, _doc):
            # 页脚页码
            canv.setFont('Helvetica', 8)
            page_num = _doc.page
            canv.setFillColor(colors.grey)
            canv.drawRightString(_doc.pagesize[0] - 0.75 * inch, 0.5 * inch, f"{page_num}")
            canv.setFillColor(colors.black)

        # Header
        story = []
        story.append(Paragraph(_bilingual("Voice Analysis Report / 声音分析报告"), title_style))
        info_rows = []
        report_time_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
        info_rows.append([
            Paragraph(_bilingual("Session ID / 会话ID"), text_style),
            Paragraph(str(session_id), text_style)
        ])
        info_rows.append([
            Paragraph(_bilingual("User / 用户"), text_style),
            Paragraph(f"{userInfo.get('userName', 'N/A')} (ID: {userInfo.get('userId', 'N/A')})", text_style)
        ])
        info_rows.append([
            Paragraph(_bilingual("Report Date / 报告时间"), text_style),
            Paragraph(report_time_utc, text_style)
        ])
        info_tbl = Table(info_rows, colWidths=[1.6*inch, None])
        info_tbl.setStyle(TableStyle([
            ('FONT', (0,0), (-1,-1), _FONT, 10),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (0,0), (0,-1), 'RIGHT'),
            ('ROWBACKGROUNDS', (0,0), (-1,-1), [LIGHT_PINK, LIGHT_GRAY]),
            ('GRID', (0,0), (-1,-1), 0.25, colors.lightgrey),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(info_tbl)
        story.append(Spacer(1, 4))
        story.append(Paragraph(_bilingual("Tool / 工具：VFS Tracker Voice Analysis（基于 Parselmouth）"), small_style))
        story.append(Spacer(1, 10))

        # ---- Metrics Section ----
        story.append(Paragraph(_bilingual("Acoustic Metrics / 声学指标"), h1_style))

        # 工具函数：安全格式化
        def _fmt(v):
            try:
                if isinstance(v, float):
                    if np.isnan(v) or np.isinf(v):
                        return '0'
                    return f"{v:.2f}"
                return str(v)
            except Exception:
                return str(v)

        # 标签的中英映射
        label_map = {
            'mpt_s': 'Maximum Phonation Time (s) / 最长发声时间（秒）',
            'f0_mean': 'Mean F0 (Hz) / 平均基频（Hz）',
            'f0_sd': 'F0 Standard Deviation (Hz) / 基频标准差（Hz）',
            'jitter_local_percent': 'Jitter Local (%) / 抖动（%）',
            'shimmer_local_percent': 'Shimmer Local (%) / 闪烁（%）',
            'hnr_db': 'HNR (dB) / 谐噪比（dB）',
            'spl_dbA_est': 'Estimated SPL dB(A) / 估计声压级 dB(A)',
            'duration_s': 'Duration (s) / 时长（秒）',
            'voiced_ratio': 'Voiced Ratio / 发声占比',
            'pause_count': 'Pause Count / 停顿次数',
            'f0_stats': 'F0 Stats / 基频统计',
            'p10': 'P10 (Hz) / 第10百分位（Hz）',
            'median': 'Median (Hz) / 中位数（Hz）',
            'p90': 'P90 (Hz) / 第90百分位（Hz）',
            'f0_min': 'Lowest F0 (P10) / 最低基频（P10）',
            'f0_max': 'Highest F0 (P90) / 最高基频（P90）',
            'spl_min': 'Lowest SPL (P10) / 最低声压级（P10）',
            'spl_max': 'Highest SPL (P90) / 最高声压级（P90）',
        }

        # 分类标题映射
        section_title_map = {
            'sustained': _bilingual('Sustained Vowel / 持续元音'),
            'reading': _bilingual('Reading / 朗读'),
            'spontaneous': _bilingual('Spontaneous Speech / 自发语音'),
            'vrp': _bilingual('Voice Range Profile / 声音范围图'),
        }

        def add_metric_block(name, data):
            if not isinstance(data, dict):
                story.append(Paragraph(f"{section_title_map.get(name, name.title())}: {_fmt(data)}", text_style))
                return
            rows = []
            for k, v in data.items():
                if k in ['formants_low', 'formants_high', 'bins', 'formant_analysis_failed']:
                    continue
                if isinstance(v, dict):
                    # 展开二级
                    rows.append([
                        Paragraph(_bilingual(label_map.get(k, k.replace('_', ' ').title())), text_style),
                        Paragraph('', text_style),
                    ])
                    for sk, sv in v.items():
                        rows.append([
                            Paragraph(_bilingual(f"• {label_map.get(sk, sk.upper())}"), text_style),
                            Paragraph(_fmt(sv), text_style),
                        ])
                else:
                    rows.append([
                        Paragraph(_bilingual(label_map.get(k, k.replace('_', ' ').title())), text_style),
                        Paragraph(_fmt(v), text_style),
                    ])
            if not rows:
                return
            tbl = Table(rows, colWidths=[3.0*inch, None], hAlign='LEFT')
            tbl.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), _FONT, 10),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('ROWSPACING', (0,0), (-1,-1), 2),
                ('ROWBACKGROUNDS', (0,0), (-1,-1), [LIGHT_PINK, LIGHT_GRAY]),
                ('GRID', (0,0), (-1,-1), 0.25, colors.lightgrey),
            ]))
            story.append(Paragraph(section_title_map.get(name, name.replace('_',' ').title()), h2_style))
            story.append(tbl)
            story.append(Spacer(1, 6))

        def add_voice_tasks_table(reading_data, spontaneous_data):
            """Combine reading and spontaneous metrics into a single table."""
            if not reading_data and not spontaneous_data:
                return
            header = [
                Paragraph("", text_style),
                Paragraph(_bilingual("Reading / 朗读"), text_style),
                Paragraph(_bilingual("Spontaneous Speech / 自发语音"), text_style),
            ]
            rows = [header]
            keys = set()
            if isinstance(reading_data, dict):
                keys |= set(reading_data.keys())
            if isinstance(spontaneous_data, dict):
                keys |= set(spontaneous_data.keys())
            for k in sorted(keys):
                rv = reading_data.get(k) if isinstance(reading_data, dict) else None
                sv = spontaneous_data.get(k) if isinstance(spontaneous_data, dict) else None
                if isinstance(rv, dict) or isinstance(sv, dict):
                    rows.append([
                        Paragraph(_bilingual(label_map.get(k, k.replace('_', ' ').title())), text_style),
                        Paragraph("", text_style),
                        Paragraph("", text_style),
                    ])
                    subkeys = set(rv.keys() if isinstance(rv, dict) else []) | set(sv.keys() if isinstance(sv, dict) else [])
                    for sk in sorted(subkeys):
                        rv_sub = rv.get(sk) if isinstance(rv, dict) else None
                        sv_sub = sv.get(sk) if isinstance(sv, dict) else None
                        rows.append([
                            Paragraph(_bilingual(f"• {label_map.get(sk, sk.upper())}"), text_style),
                            Paragraph(_fmt(rv_sub) if rv_sub is not None else '-', text_style),
                            Paragraph(_fmt(sv_sub) if sv_sub is not None else '-', text_style),
                        ])
                else:
                    rows.append([
                        Paragraph(_bilingual(label_map.get(k, k.replace('_', ' ').title())), text_style),
                        Paragraph(_fmt(rv) if rv is not None else '-', text_style),
                        Paragraph(_fmt(sv) if sv is not None else '-', text_style),
                    ])
            tbl = Table(rows, colWidths=[2.8*inch, 1.2*inch, 1.2*inch])
            tbl.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), _FONT, 10),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('ROWSPACING', (0,0), (-1,-1), 2),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [LIGHT_PINK, LIGHT_GRAY]),
                ('GRID', (0,0), (-1,-1), 0.25, colors.lightgrey),
            ]))
            story.append(Paragraph(_bilingual("Voice Tasks / 语音任务"), h2_style))
            story.append(tbl)
            story.append(Spacer(1, 6))

        def add_questionnaire_table(scores):
            """Render subjective questionnaire scores as 2-row table.

            First row lists the questionnaire names, second row shows the
            corresponding results."""
            if not scores:
                return
            names, values = [], []
            for k, v in scores.items():
                names.append(Paragraph(k.upper(), text_style))
                if isinstance(v, dict):
                    detail = ", ".join([f"{sk.upper()}: {_fmt(sv)}" for sk, sv in v.items()])
                    values.append(Paragraph(detail, text_style))
                else:
                    values.append(Paragraph(_fmt(v), text_style))
            while len(names) < 4:
                names.append(Paragraph("", text_style))
                values.append(Paragraph("", text_style))
            qt = Table([names, values], colWidths=[doc.width/4.0]*4)
            qt.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), _FONT, 10),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('ROWBACKGROUNDS', (0,0), (-1,-1), [LIGHT_PINK, LIGHT_GRAY]),
                ('GRID', (0,0), (-1,-1), 0.25, colors.lightgrey),
            ]))
            story.append(Paragraph(_bilingual("Subjective Questionnaires / 主观量表"), h2_style))
            story.append(qt)
            story.append(Spacer(1, 6))

        # ---- Chart Embedding Utilities ----
        def parse_s3_url(url: str):
            if not url or not url.startswith('s3://'):
                return None, None
            parts = url[5:].split('/', 1)
            return (parts[0], parts[1]) if len(parts) == 2 else (None, None)

        s3 = boto3.client('s3')

        def embed_chart(key_name: str, title: str, caption: str, max_height=None):
            """Create a flowable for a chart image from S3 with optional caption."""
            url = chart_urls.get(key_name)
            bkt, obj_key = parse_s3_url(url) if url else (None, None)
            elements = [Paragraph(_bilingual(title), h2_style), Spacer(1, 4)]
            img_buf = None
            if bkt:
                try:
                    obj = s3.get_object(Bucket=bkt, Key=obj_key)
                    img_buf = BytesIO(obj['Body'].read())
                except Exception as e:
                    logger.error(f"Failed embedding chart {key_name}: {e}")
            if img_buf is None:
                img_buf = create_placeholder_chart(title.split(' / ')[0], 'Chart unavailable. / 图表不可用')
            img = RLImage(img_buf)
            img.hAlign = 'CENTER'
            iw, ih = img.imageWidth, img.imageHeight
            max_w = doc.width
            max_h_default = doc.height - 1.2 * inch
            max_h_val = max_height if max_height is not None else max_h_default
            scale = min(max_w/iw, max_h_val/ih, 1.0)
            img.drawWidth, img.drawHeight = iw * scale, ih * scale
            elements.append(img)
            if caption:
                elements.append(Spacer(1, 2))
                elements.append(Paragraph(_bilingual(caption), small_style))
            return KeepTogether(elements)

        # ---- Subjective Questionnaires moved to first page ----
        questionnaire_scores = metrics.get('questionnaires')

        # ---- Sustained Vowel ----
        sustained_data = metrics.get('sustained')
        if sustained_data:
            add_metric_block('sustained', sustained_data)
            story.append(
                embed_chart(
                    'timeSeries',
                    'Time Series Waveform & F0 / 波形与基频',
                    'Based on sustained vowel recording / 基于持续元音录音',
                )
            )
            # 主观量表移至第一页，与持续元音结果同页呈现
            if questionnaire_scores:
                add_questionnaire_table(questionnaire_scores)
            # 第一页结束
            story.append(PageBreak())

        # ---- Voice Tasks with VRP on same page ----
        reading_data = metrics.get('reading') if isinstance(metrics.get('reading'), dict) else {}
        spontaneous_data = metrics.get('spontaneous') if isinstance(metrics.get('spontaneous'), dict) else {}
        vrp_data = metrics.get('vrp') if isinstance(metrics.get('vrp'), dict) else {}
        if reading_data or spontaneous_data or vrp_data:
            if reading_data or spontaneous_data:
                add_voice_tasks_table(reading_data, spontaneous_data)
            if vrp_data:
                add_metric_block('vrp', vrp_data)
                story.append(
                    embed_chart(
                        'vrp',
                        'Voice Range Profile (VRP) / 声音范围图',
                        'Based on glide exercises / 基于滑音练习',
                    )
                )
            # 语音任务与VRP共用一页
            story.append(PageBreak())

        # ---- Formant Analysis ----
        sustained_metrics = metrics.get('sustained', {}) if isinstance(metrics.get('sustained'), dict) else {}
        formant_low = sustained_metrics.get('formants_low')
        formant_high = sustained_metrics.get('formants_high')
        formant_failed = sustained_metrics.get('formant_analysis_failed')

        formant_section = [Paragraph(_bilingual("Formant Analysis / 共振峰分析"), h2_style)]
        if formant_failed:
            bullet = (
                "Analysis failed. Common causes / 分析失败，常见原因：<br/>"
                "- Very low volume or too soft / 音量过低或发声太轻；<br/>"
                "- Excessive noise, coughing, throat clearing / 背景噪声、咳嗽或清嗓；<br/>"
                "- Not holding a stable /a/ vowel / /a/ 元音不稳定。"
            )
            formant_section.append(Paragraph(bullet, text_style))
        else:
            if formant_low or formant_high:
                headers = [
                    Paragraph("", text_style),
                    Paragraph(_bilingual("Lowest Note / 最低音"), text_style),
                    Paragraph(_bilingual("Highest Note / 最高音"), text_style),
                ]
                rows = [headers]
                formant_labels = [
                    ('f0_mean', 'Mean F0 (Hz) / 平均基频（Hz）'),
                    ('F1', 'F1 (Hz) / F1（Hz）'),
                    ('F2', 'F2 (Hz) / F2（Hz）'),
                    ('F3', 'F3 (Hz) / F3（Hz）'),
                    ('spl_dbA_est', 'SPL dB(A) / 声压级 dB(A)'),
                ]
                for key, label in formant_labels:
                    rows.append([
                        Paragraph(_bilingual(label), text_style),
                        Paragraph(_fmt((formant_low or {}).get(key, 0)), text_style),
                        Paragraph(_fmt((formant_high or {}).get(key, 0)), text_style),
                    ])
                ft = Table(rows, colWidths=[2.2*inch, 1.2*inch, 1.2*inch])
                ft.setStyle(TableStyle([
                    ('FONT', (0,0), (-1,-1), _FONT, 10),
                    ('ROWBACKGROUNDS', (0,0), (-1,-1), [LIGHT_PINK, LIGHT_GRAY]),
                    ('GRID', (0,0), (-1,-1), 0.25, colors.lightgrey),
                    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ]))
                formant_section.append(ft)
                formant_section.append(Spacer(1, 6))
                formant_section.append(
                    embed_chart(
                        'formant',
                        'F1-F2 Vowel Space / F1-F2 元音空间',
                        'Based on lowest & highest note / 基于最低与最高音',
                        max_height=3.0*inch,
                    )
                )
                formant_section.append(Spacer(1, 4))
                formant_section.append(
                    embed_chart(
                        'formant_spl_spectrum',
                        'Formant-SPL Spectrum (LPC) / 共振峰-声压谱（LPC）',
                        'Based on lowest & highest note / 基于最低与最高音',
                        max_height=3.0*inch,
                    )
                )
        formant_section.append(Spacer(1, 6))
        story.append(KeepTogether(formant_section))

        # 构建 PDF
        doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
        buf.seek(0)
        logger.info(f"Successfully created PDF report with embedded charts for session {session_id}")
        return buf

    except Exception as e:
        logger.error(f"Could not create PDF report for {session_id}. Error: {e}")
        return None
