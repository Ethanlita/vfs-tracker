import logging
from io import BytesIO
import matplotlib.pyplot as plt
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

logger = logging.getLogger()
logger.setLevel(logging.INFO)

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
        return None

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
        # 回退到旧占位
        fig, ax = plt.subplots(figsize=(8, 6))
        ax.set_xlabel('Frequency (Hz)')
        ax.set_ylabel('Intensity (dB SPL)')
        ax.set_title('Voice Range Profile (Placeholder)')
        ax.text(0.5, 0.5, 'VRP Data Unavailable', ha='center', va='center', transform=ax.transAxes)
        ax.grid(True)
        buf = BytesIO()
        plt.savefig(buf, format='png')
        buf.seek(0)
        plt.close(fig)
        return buf

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
        buf = BytesIO()
        p = canvas.Canvas(buf, pagesize=letter)
        width, height = letter
        margin = inch

        # Title
        p.setFont("Helvetica-Bold", 18)
        p.drawCentredString(width / 2.0, height - margin, "Voice Analysis Report")
        
        # Sub-header section
        y_cursor = height - margin - 25
        p.setFont("Helvetica", 10)
        p.drawCentredString(width / 2.0, y_cursor, f"Session ID: {session_id}")
        y_cursor -= 15
        p.drawCentredString(width / 2.0, y_cursor, f"User: {userInfo.get('userName', 'N/A')} (ID: {userInfo.get('userId', 'N/A')})")
        y_cursor -= 15
        report_time_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
        p.drawCentredString(width / 2.0, y_cursor, f"Report Date: {report_time_utc}")
        y_cursor -= 15
        p.setFont("Helvetica-Oblique", 9)
        p.drawCentredString(width/2.0, y_cursor, "Tool: VFS Tracker Voice Analysis Tool based on Parselmouth")

        # --- Metrics Section ---
        y_cursor = height - 2*margin - 20 # Adjust starting position
        text = p.beginText(margin, y_cursor)

        def check_page_break(current_y, threshold=margin + 120):
            if current_y < threshold:
                p.drawText(text)
                p.showPage()
                text.setTextOrigin(margin, height - margin)
                return True
            return False

        # --- Acoustic Metrics ---
        p.setFont("Helvetica-Bold", 14)
        p.drawString(margin, y_cursor, "Acoustic Metrics")
        y_cursor -= 8
        p.line(margin, y_cursor, width - margin, y_cursor)
        y_cursor -= 12
        text.setTextOrigin(margin, y_cursor)
        text.setFont("Helvetica", 10)
        
        acoustic_categories = [cat for cat in metrics if cat != 'questionnaires']
        for category in acoustic_categories:
            block_data = metrics[category]
            block_title = category.replace('_',' ').title()
            
            text.setFont("Helvetica-Bold", 11)
            text.textLine(block_title)
            text.setFont("Helvetica", 10)
            
            for key, value in block_data.items():
                if key in ['formants_low', 'formants_high', 'bins']:
                    continue
                
                label = key.replace('_',' ').title()
                if key == 'f0_min':
                    label = "Lowest F0 (10th Percentile)"
                elif key == 'f0_max':
                    label = "Highest F0 (90th Percentile)"

                if isinstance(value, dict):
                    text.textLine(f"  {label}:")
                    for sub_key, sub_val in value.items():
                        text.textLine(f"    {sub_key}: {sub_val}")
                else:
                    text.textLine(f"  {label}: {value}")
            text.moveCursor(0, 10)

        # --- Formant Analysis ---
        sustained_metrics = metrics.get('sustained', {})
        formant_low = sustained_metrics.get('formants_low')
        formant_high = sustained_metrics.get('formants_high')
        if formant_low or formant_high:
            text.setFont("Helvetica-Bold", 11)
            text.textLine("Formant Analysis")
            text.setFont("Helvetica", 10)
            if formant_low:
                text.textLine(f"  Lowest Note: F1={formant_low.get('F1', 0):.0f}Hz, F2={formant_low.get('F2', 0):.0f}Hz, F3={formant_low.get('F3', 0):.0f}Hz, SPL={formant_low.get('spl_dbA_est', 0):.1f}dB")
            if formant_high:
                text.textLine(f"  Highest Note: F1={formant_high.get('F1', 0):.0f}Hz, F2={formant_high.get('F2', 0):.0f}Hz, F3={formant_high.get('F3', 0):.0f}Hz, SPL={formant_high.get('spl_dbA_est', 0):.1f}dB")
            text.moveCursor(0, 10)

        p.drawText(text)
        y_cursor = text.getY()

        # --- Subjective Questionnaires ---
        questionnaire_scores = metrics.get('questionnaires')
        if questionnaire_scores:
            y_cursor -= 20
            if y_cursor < margin + 120:
                p.showPage()
                y_cursor = height - margin

            p.setFont("Helvetica-Bold", 14)
            p.drawString(margin, y_cursor, "Subjective Questionnaires")
            y_cursor -= 8
            p.line(margin, y_cursor, width - margin, y_cursor)
            y_cursor -= 12
            text.setTextOrigin(margin, y_cursor)
            text.setFont("Helvetica", 10)

            for key, value in questionnaire_scores.items():
                if isinstance(value, dict):
                    rbh_str = ", ".join([f"{k.upper()}: {v}" for k, v in value.items()])
                    text.textLine(f"  {key}: {rbh_str}")
                else:
                    text.textLine(f"  {key}: {value}")
            p.drawText(text)
            y_cursor = text.getY()

        # --- Charts Section ---
        def parse_s3_url(url: str):
            if not url or not url.startswith('s3://'): return None, None
            parts = url[5:].split('/',1)
            return (parts[0], parts[1]) if len(parts) == 2 else (None, None)

        s3 = boto3.client('s3')
        chart_order = [('timeSeries', 'Time Series Waveform & F0'), ('vrp', 'Voice Range Profile (VRP)')]

        for key_name, title in chart_order:
            url = chart_urls.get(key_name)
            if not url: continue
            bkt, obj_key = parse_s3_url(url)
            if not bkt: continue
            try:
                obj = s3.get_object(Bucket=bkt, Key=obj_key)
                data = obj['Body'].read()
                img_reader = ImageReader(BytesIO(data))
                p.showPage()
                p.setFont("Helvetica-Bold", 14)
                p.drawString(margin, height - margin, title)
                img_w, img_h = img_reader.getSize()
                max_w, max_h = width - 2*margin, height - 2*margin - 30
                scale = min(max_w / img_w, max_h / img_h, 1.0)
                draw_w, draw_h = img_w * scale, img_h * scale
                x, y = (width - draw_w)/2, (height - margin - 30 - draw_h)
                p.drawImage(img_reader, x, y, width=draw_w, height=draw_h, preserveAspectRatio=True, anchor='c')
            except Exception as e:
                logger.error(f"Failed embedding chart {key_name}: {e}")
                p.showPage()
                p.setFont("Helvetica-Bold", 14)
                p.drawString(margin, height - margin, title)
                p.setFont("Helvetica", 10)
                p.drawString(margin, height - margin - 20, f"(Failed to embed image. URL: {url})")

        p.showPage()
        p.save()
        buf.seek(0)
        logger.info(f"Successfully created PDF report with embedded charts for session {session_id}")
        return buf

    except Exception as e:
        logger.error(f"Could not create PDF report for {session_id}. Error: {e}")
        return None
