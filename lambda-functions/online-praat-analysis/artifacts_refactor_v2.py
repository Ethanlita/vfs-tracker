"""
[CN] Online Praat Analysis v2 图表模块。

包含：
1) VRP（glissando散点 + 分箱包络 + soft/loud锚点）
2) 扩展 Formant–SPL（F1/F2/F3 vs SPL）
"""
from __future__ import annotations

import logging
from io import BytesIO
from typing import Dict, List

import numpy as np
import matplotlib.pyplot as plt
from matplotlib.ticker import ScalarFormatter

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _safe_np(arr):
    """[CN] 将输入安全转换为 numpy array。"""
    return np.asarray(arr, dtype=float) if arr is not None else np.asarray([], dtype=float)


def _safe_float(v):
    """[CN] 安全转换为 float，失败返回 NaN。"""
    try:
        out = float(v)
        return out if np.isfinite(out) else np.nan
    except Exception:
        return np.nan


def create_vrp_chart_v2(glide_rows: List[Dict], vrp_bins: List[Dict], anchors: Dict) -> BytesIO | None:
    """
    [CN] 生成 v2 VRP 图。

    图层：
    - glissando 帧级散点（F0 vs SPL）
    - 按半音分箱后的 q05/q95 包络
    - soft-a / loud-a 锚点（均值±MAD）
    """
    try:
        if not glide_rows:
            raise ValueError('no glide rows')

        fig, ax = plt.subplots(figsize=(10, 6))

        # 1) Glissando scatter
        gx = _safe_np([r.get('f0_hz') for r in glide_rows])
        gy = _safe_np([r.get('spl_db') for r in glide_rows])
        mask = np.isfinite(gx) & np.isfinite(gy)
        gx, gy = gx[mask], gy[mask]
        if gx.size == 0:
            raise ValueError('no valid glide scatter points')
        ax.scatter(gx, gy, s=10, alpha=0.18, color='#64748b', label='Glissando frames')

        # 2) Envelope from semitone bins
        if vrp_bins:
            fx = _safe_np([b.get('f0_center_hz') for b in vrp_bins])
            lo = _safe_np([b.get('spl_min') for b in vrp_bins])
            hi = _safe_np([b.get('spl_max') for b in vrp_bins])
            mean = _safe_np([b.get('spl_mean') for b in vrp_bins])
            m2 = np.isfinite(fx) & np.isfinite(lo) & np.isfinite(hi)
            fx, lo, hi = fx[m2], lo[m2], hi[m2]
            if fx.size > 0:
                order = np.argsort(fx)
                fx, lo, hi = fx[order], lo[order], hi[order]
                ax.fill_between(fx, lo, hi, color='#93c5fd', alpha=0.30, label='Bin envelope (q05-q95)')
            m3 = np.isfinite(mean)
            if np.any(m3):
                fxm, mm = _safe_np([b.get('f0_center_hz') for b in vrp_bins])[m3], mean[m3]
                order2 = np.argsort(fxm)
                ax.plot(fxm[order2], mm[order2], color='#2563eb', linewidth=1.8, label='Bin mean SPL')

        # 3) Anchors: soft/loud
        for task_name, color in (('soft_a', '#16a34a'), ('loud_a', '#dc2626')):
            point = anchors.get(task_name) if isinstance(anchors, dict) else None
            if not isinstance(point, dict):
                continue
            f0 = _safe_float(point.get('f0_hz'))
            spl = _safe_float(point.get('spl_db'))
            mad = _safe_float(point.get('spl_mad_db', 0.0))
            if np.isfinite(f0) and np.isfinite(spl):
                ax.scatter([f0], [spl], s=70, color=color, marker='D', label=f'{task_name} anchor')
                if np.isfinite(mad) and mad > 0:
                    ax.vlines(f0, spl - mad, spl + mad, color=color, linewidth=1.2)

        ax.set_title('VRP (Observed Envelope) with Soft/Loud Anchors')
        ax.set_xlabel('F0 (Hz)')
        ax.set_ylabel('SPL (dB)')
        ax.grid(True, linestyle='--', alpha=0.35)
        ax.xaxis.set_major_formatter(ScalarFormatter())
        ax.legend(loc='best', fontsize=8)

        buf = BytesIO()
        fig.tight_layout()
        plt.savefig(buf, format='png', dpi=220)
        buf.seek(0)
        plt.close(fig)
        return buf
    except Exception as e:
        logger.error(f'create_vrp_chart_v2 failed: {e}', exc_info=True)
        return None


def _compute_envelope(xs: np.ndarray, ys: np.ndarray, bin_width: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """[CN] 在 x 轴上分箱后，返回 (bin_center, y_q05, y_q95)。"""
    if xs.size == 0 or ys.size == 0:
        return np.asarray([]), np.asarray([]), np.asarray([])
    xmin, xmax = np.nanmin(xs), np.nanmax(xs)
    if not np.isfinite(xmin) or not np.isfinite(xmax) or xmax <= xmin:
        return np.asarray([]), np.asarray([]), np.asarray([])
    bins = np.arange(xmin, xmax + bin_width, bin_width)
    if bins.size < 2:
        bins = np.array([xmin, xmax + max(bin_width, 1.0)])

    centers, lo, hi = [], [], []
    idx = np.digitize(xs, bins)
    for bi in range(1, len(bins)):
        mask = idx == bi
        if np.sum(mask) < 5:
            continue
        y = ys[mask]
        y = y[np.isfinite(y)]
        if y.size < 5:
            continue
        centers.append((bins[bi - 1] + bins[bi]) / 2)
        lo.append(float(np.nanpercentile(y, 5)))
        hi.append(float(np.nanpercentile(y, 95)))
    return _safe_np(centers), _safe_np(lo), _safe_np(hi)


def _fit_linear(xs: np.ndarray, ys: np.ndarray) -> tuple[float, float] | None:
    """[CN] 计算 y = kx + b 的最小二乘拟合，数据不足时返回 None。"""
    if xs.size < 8 or ys.size < 8:
        return None
    mask = np.isfinite(xs) & np.isfinite(ys)
    x = xs[mask]
    y = ys[mask]
    if x.size < 8:
        return None
    x_std = float(np.nanstd(x))
    if not np.isfinite(x_std) or x_std < 1e-6:
        return None
    k, b = np.polyfit(x, y, 1)
    if not (np.isfinite(k) and np.isfinite(b)):
        return None
    return float(k), float(b)


def create_formant_spl_expanded_chart_v2(stable_points: List[Dict], exploratory_points: List[Dict]) -> BytesIO | None:
    """
    [CN] 生成扩展 Formant–SPL 图（3联图）。

    子图：
    - F1 vs SPL
    - F2 vs SPL
    - F3 vs SPL

    数据：
    - stable_points: soft/loud /a/ 稳态点
    - exploratory_points: read/free 的探索性帧级点
    """
    try:
        fig, axes = plt.subplots(1, 3, figsize=(15, 5), sharey=True)
        dims = (('f1_hz', 'F1'), ('f2_hz', 'F2'), ('f3_hz', 'F3'))

        for ax, (key, label) in zip(axes, dims):
            last_ex_x = np.asarray([], dtype=float)
            last_ex_y = np.asarray([], dtype=float)

            # Exploratory cloud
            if exploratory_points:
                x = _safe_np([p.get(key) for p in exploratory_points])
                y = _safe_np([p.get('spl_db') for p in exploratory_points])
                m = np.isfinite(x) & np.isfinite(y)
                x, y = x[m], y[m]
                if x.size > 0:
                    last_ex_x, last_ex_y = x, y
                    ax.scatter(x, y, s=8, alpha=0.12, color='#94a3b8', label='read/free frames')
                    # boundary envelope on formant axis
                    bw = 50.0 if key == 'f1_hz' else 100.0
                    cx, lo, hi = _compute_envelope(x, y, bw)
                    if cx.size > 0:
                        ax.fill_between(cx, lo, hi, color='#bfdbfe', alpha=0.25, label='q05-q95 envelope')

                    # exploratory regression (uncontrolled)
                    fit = _fit_linear(x, y)
                    if fit is not None:
                        k, b = fit
                        xr = np.linspace(np.nanpercentile(x, 2), np.nanpercentile(x, 98), 50)
                        yr = k * xr + b
                        ax.plot(xr, yr, color='#7c3aed', linewidth=1.5, linestyle='--', label='Exploratory OLS (uncontrolled)')

            # Stable anchors
            if stable_points:
                sx = _safe_np([p.get(key) for p in stable_points])
                sy = _safe_np([p.get('spl_db') for p in stable_points])
                st = [p.get('task', 'stable') for p in stable_points]
                for i in range(len(st)):
                    if np.isfinite(sx[i]) and np.isfinite(sy[i]):
                        c = '#16a34a' if st[i] == 'soft_a' else '#dc2626'
                        ax.scatter([sx[i]], [sy[i]], s=80, marker='D', color=c, label=f'{st[i]} anchor')
                        ax.text(sx[i], sy[i], f' {st[i]}', fontsize=8)

                # line segment between soft/loud anchors for readability
                if sx.size >= 2 and sy.size >= 2:
                    valid = np.isfinite(sx) & np.isfinite(sy)
                    sx2 = sx[valid]
                    sy2 = sy[valid]
                    if sx2.size >= 2:
                        order = np.argsort(sx2)
                        ax.plot(sx2[order], sy2[order], color='#111827', linewidth=1.2, alpha=0.8, label='soft→loud segment')

            ax.set_title(f'{label} vs SPL')
            ax.set_xlabel(f'{label} (Hz)')
            ax.grid(True, linestyle='--', alpha=0.35)
            ax.xaxis.set_major_formatter(ScalarFormatter())

        axes[0].set_ylabel('SPL (dB)')

        # 汇总所有子图的图例项并去重
        all_handles, all_labels = [], []
        for ax in axes:
            h, l = ax.get_legend_handles_labels()
            all_handles.extend(h)
            all_labels.extend(l)
        dedup = {}
        for h, l in zip(all_handles, all_labels):
            if l and l not in dedup:
                dedup[l] = h
        if dedup:
            fig.legend(list(dedup.values()), list(dedup.keys()), loc='upper center', ncol=3, bbox_to_anchor=(0.5, 1.07), fontsize=8)

        fig.text(
            0.5,
            0.01,
            'Reading guide: green/red diamonds are soft/loud stable anchors; gray cloud is exploratory read/free frames (with phonetic confounds); purple dashed line is exploratory OLS without F0 control.',
            ha='center',
            va='bottom',
            fontsize=8,
            color='#334155',
        )

        buf = BytesIO()
        fig.tight_layout(rect=(0.0, 0.05, 1.0, 0.95))
        plt.savefig(buf, format='png', dpi=220)
        buf.seek(0)
        plt.close(fig)
        return buf
    except Exception as e:
        logger.error(f'create_formant_spl_expanded_chart_v2 failed: {e}', exc_info=True)
        return None
