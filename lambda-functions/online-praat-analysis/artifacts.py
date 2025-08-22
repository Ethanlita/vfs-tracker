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
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# 注册支持中文的字体（无需外部 TTF）
try:
    pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))  # 简体中文支持
    _CJK_FONT = 'STSong-Light'
except Exception:
    # 回退（仍可工作，但中文可能无法正确显示）
    _CJK_FONT = 'Helvetica'


def create_placeholder_chart(title: str, message: str):
    """Creates a placeholder chart with a title and a message."""
    logger.info(f"Creating placeholder chart: {title}")
    try:
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.text(0.5, 0.5, message, ha='center', va='center', fontsize=12, color='gray', wrap=True)
        ax.set_title(title)
        ax.set_xticks([])
        ax.set_yticks([])
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['bottom'].set_visible(False)
        ax.spines['left'].set_visible(False)
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
        ax1.set_ylim([-1, 1])
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
        ax.set_xscale('log')
        ax.xaxis.set_major_formatter(ScalarFormatter()) # Disable scientific notation for log scale
        ax.set_xlabel('Frequency (Hz) (log)')
        ax.set_ylabel('SPL dB(A) (est)')
        ax.set_title('Voice Range Profile')
        ax.grid(True, which='both', linestyle='--', alpha=0.4)
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
        ax.xaxis.set_major_formatter(ScalarFormatter()) # Disable scientific notation
        ax.grid(True, linestyle='--', alpha=0.6)
        ax.legend()
        ax.set_xlim(0, 5500)

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
            leftMargin=0.75 * inch,
            rightMargin=0.75 * inch,
            topMargin=0.8 * inch,
            bottomMargin=0.8 * inch,
        )
        styles = getSampleStyleSheet()
        # 基础样式
        title_style = ParagraphStyle(
            'TitleCnEn',
            parent=styles['Title'],
            alignment=TA_CENTER,
            fontName=_CJK_FONT,
            fontSize=20,
            leading=24,
            spaceAfter=6,
        )
        subtitle_style = ParagraphStyle(
            'Subtitle', parent=styles['Normal'], alignment=TA_CENTER, fontName=_CJK_FONT, fontSize=10, leading=14
        )
        h1_style = ParagraphStyle(
            'H1', parent=styles['Heading1'], fontName=_CJK_FONT, fontSize=14, leading=18, spaceBefore=6, spaceAfter=4
        )
        h2_style = ParagraphStyle(
            'H2', parent=styles['Heading2'], fontName=_CJK_FONT, fontSize=12, leading=16, spaceBefore=4, spaceAfter=2
        )
        text_style = ParagraphStyle(
            'Body', parent=styles['Normal'], fontName=_CJK_FONT, fontSize=10, leading=14
        )
        small_style = ParagraphStyle(
            'Small', parent=styles['Normal'], fontName=_CJK_FONT, fontSize=8, leading=11, textColor=colors.grey
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
        story.append(Paragraph("Voice Analysis Report / 声音分析报告", title_style))
        info_rows = []
        report_time_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
        info_rows.append([
            Paragraph("Session ID / 会话ID", text_style),
            Paragraph(str(session_id), text_style)
        ])
        info_rows.append([
            Paragraph("User / 用户", text_style),
            Paragraph(f"{userInfo.get('userName', 'N/A')} (ID: {userInfo.get('userId', 'N/A')})", text_style)
        ])
        info_rows.append([
            Paragraph("Report Date / 报告时间", text_style),
            Paragraph(report_time_utc, text_style)
        ])
        info_tbl = Table(info_rows, colWidths=[1.6*inch, None])
        info_tbl.setStyle(TableStyle([
            ('FONT', (0,0), (-1,-1), _CJK_FONT, 10),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (0,0), (0,-1), 'RIGHT'),
            ('LINEBELOW', (0,-1), (-1,-1), 0.25, colors.lightgrey),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(info_tbl)
        story.append(Spacer(1, 4))
        story.append(Paragraph("Tool / 工具：VFS Tracker Voice Analysis（基于 Parselmouth）", small_style))
        story.append(Spacer(1, 10))

        # ---- Metrics Section ----
        story.append(Paragraph("Acoustic Metrics / 声学指标", h1_style))

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
            'sustained': 'Sustained Vowel / 持续元音',
            'reading': 'Reading / 朗读',
            'spontaneous': 'Spontaneous Speech / 自发语音',
            'vrp': 'Voice Range Profile / 声音范围图',
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
                    rows.append([Paragraph(label_map.get(k, k.replace('_',' ').title()), text_style), Paragraph('', text_style)])
                    for sk, sv in v.items():
                        rows.append([Paragraph(f"• {label_map.get(sk, sk.upper())}", text_style), Paragraph(_fmt(sv), text_style)])
                else:
                    rows.append([Paragraph(label_map.get(k, k.replace('_',' ').title()), text_style), Paragraph(_fmt(v), text_style)])
            if not rows:
                return
            tbl = Table(rows, colWidths=[3.0*inch, None], hAlign='LEFT')
            tbl.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), _CJK_FONT, 10),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('ROWSPACING', (0,0), (-1,-1), 2),
                ('LINEBELOW', (0,0), (-1,-1), 0.1, colors.whitesmoke),
            ]))
            story.append(Paragraph(section_title_map.get(name, name.replace('_',' ').title()), h2_style))
            story.append(tbl)
            story.append(Spacer(1, 6))

        # 只遍历非问卷部分
        acoustic_categories = [cat for cat in metrics if cat != 'questionnaires']
        for cat in acoustic_categories:
            add_metric_block(cat, metrics.get(cat))

        # Formant Analysis / 共振峰分析
        sustained_metrics = metrics.get('sustained', {}) if isinstance(metrics.get('sustained'), dict) else {}
        formant_low = sustained_metrics.get('formants_low')
        formant_high = sustained_metrics.get('formants_high')
        formant_failed = sustained_metrics.get('formant_analysis_failed')

        story.append(Spacer(1, 4))
        story.append(Paragraph("Formant Analysis / 共振峰分析", h2_style))
        if formant_failed:
            bullet = (
                "Analysis failed. Common causes / 分析失败，常见原因：<br/>"
                "- Very low volume or too soft / 音量过低或发声太轻；<br/>"
                "- Excessive noise, coughing, throat clearing / 背景噪声、咳嗽或清嗓；<br/>"
                "- Not holding a stable /a/ vowel / /a/ 元音不稳定。"
            )
            story.append(Paragraph(bullet, text_style))
        else:
            if formant_low:
                story.append(Paragraph(
                    f"Lowest Note / 最低音：F1={formant_low.get('F1',0):.0f} Hz，F2={formant_low.get('F2',0):.0f} Hz，F3={formant_low.get('F3',0):.0f} Hz，SPL={formant_low.get('spl_dbA_est',0):.1f} dB",
                    text_style
                ))
            if formant_high:
                story.append(Paragraph(
                    f"Highest Note / 最高音：F1={formant_high.get('F1',0):.0f} Hz，F2={formant_high.get('F2',0):.0f} Hz，F3={formant_high.get('F3',0):.0f} Hz，SPL={formant_high.get('spl_dbA_est',0):.1f} dB",
                    text_style
                ))
        story.append(Spacer(1, 8))

        # ---- Questionnaires ----
        questionnaire_scores = metrics.get('questionnaires')
        if questionnaire_scores:
            story.append(Paragraph("Subjective Questionnaires / 主观量表", h1_style))
            rows = []
            for key, value in questionnaire_scores.items():
                if isinstance(value, dict):
                    rbh_str = ", ".join([f"{k.upper()}: {v}" for k, v in value.items()])
                    rows.append([Paragraph(key, text_style), Paragraph(rbh_str, text_style)])
                else:
                    rows.append([Paragraph(key, text_style), Paragraph(_fmt(value), text_style)])
            qt = Table(rows, colWidths=[2.5*inch, None])
            qt.setStyle(TableStyle([
                ('FONT', (0,0), (-1,-1), _CJK_FONT, 10),
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('ROWSPACING', (0,0), (-1,-1), 2),
                ('LINEBELOW', (0,0), (-1,-1), 0.1, colors.whitesmoke),
            ]))
            story.append(qt)
            story.append(Spacer(1, 8))

        # ---- Charts ----
        def parse_s3_url(url: str):
            if not url or not url.startswith('s3://'):
                return None, None
            parts = url[5:].split('/', 1)
            return (parts[0], parts[1]) if len(parts) == 2 else (None, None)

        s3 = boto3.client('s3')
        chart_order = [
            ('timeSeries', 'Time Series Waveform & F0 / 波形与基频'),
            ('vrp', 'Voice Range Profile (VRP) / 声音范围图'),
            ('formant', 'F1-F2 Vowel Space / F1-F2 元音空间'),
            ('formant_spl_spectrum', 'Formant-SPL Spectrum (LPC) / 共振峰-声压谱（LPC）')
        ]

        for key_name, title in chart_order:
            url = chart_urls.get(key_name)
            if not url:
                continue
            bkt, obj_key = parse_s3_url(url)
            if not bkt:
                continue
            try:
                obj = s3.get_object(Bucket=bkt, Key=obj_key)
                data = obj['Body'].read()
                # 创建图片并按页宽限制缩放
                img = RLImage(BytesIO(data))
                img.hAlign = 'CENTER'
                iw, ih = img.imageWidth, img.imageHeight
                max_w, max_h = doc.width, doc.height - 1.2 * inch
                scale = min(max_w/iw, max_h/ih, 1.0)
                img.drawWidth, img.drawHeight = iw * scale, ih * scale
                story.append(PageBreak())
                story.append(Paragraph(title, h1_style))
                story.append(Spacer(1, 6))
                story.append(img)
            except Exception as e:
                logger.error(f"Failed embedding chart {key_name}: {e}")
                story.append(PageBreak())
                story.append(Paragraph(title, h1_style))
                story.append(Paragraph(f"Failed to embed image. URL: {url}", small_style))

        # 构建 PDF
        doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
        buf.seek(0)
        logger.info(f"Successfully created PDF report with embedded charts for session {session_id}")
        return buf

    except Exception as e:
        logger.error(f"Could not create PDF report for {session_id}. Error: {e}")
        return None
