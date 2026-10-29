"""합성한 음절(예: 'ʃɑ')에서 목표 소리만 잘라 낸다.
  python segment-phoneme.py <in.wav> <out.wav> <mode> <cap_sec> <vowel_template.wav> [sustain]
  mode: cons(앞 자음만) · stop(끊어지는 앞 자음) · final(모음 뒤 자음만) · vowel(전체 소리)
모음 /ɑ/ 만 따로 합성한 소리의 스펙트럼 모양(소리 높낮이·크기와 상관없이)을 기준으로, 음절 안에서 모음이 시작·끝나는 곳을 찾아
자음 부분만 남긴다. sustain 이면 숨을 길게 낼 수 있는 소리(s f sh m n l …)를 가운데 부분을 이어 붙여 0.7초로 늘린다.
결과는 반드시 귀로 검수한다."""
import sys, wave
import numpy as np
from scipy.signal import stft

src, dst, mode, cap, tpl = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), sys.argv[5]
sustain = len(sys.argv) > 6 and sys.argv[6] == 'sustain'
def load(p):
    w = wave.open(p); sr = w.getframerate()
    return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768, sr
x, sr = load(src)
HOP = int(sr * 0.005)
def feats(sig):
    f, t, Z = stft(sig, fs=sr, nperseg=int(sr * 0.025), noverlap=int(sr * 0.025) - HOP)
    P = np.abs(Z) ** 2
    edges = np.geomspace(200, 5000, 17)
    bands = np.array([P[(f >= a) & (f < b)].sum(axis=0) for a, b in zip(edges[:-1], edges[1:])])
    L = np.log10(bands + 1e-9)
    return L - L.mean(axis=0, keepdims=True), np.sqrt(P.sum(axis=0))  # 모양, 크기
Fx, Ex = feats(x)
n = Fx.shape[1]
act = np.where(Ex > 0.08 * Ex.max())[0]
t0, t1 = act[0], act[-1] + 1
if mode == 'vowel':
    a, b = max(0, t0 - 2), min(t1 + 2, t0 + int(cap / 0.005))
elif mode == 'fixed':
    a, b = max(0, t0 - 2), min(n, t0 + int(cap / 0.005))
else:
    xt, _ = load(tpl); Ft, Et = feats(xt)
    at = np.where(Et > 0.08 * Et.max())[0]; mid = slice(at[0] + (at[-1] - at[0]) // 3, at[0] + 2 * (at[-1] - at[0]) // 3)
    ref = Ft[:, mid].mean(axis=1)
    dist = np.sqrt(((Fx - ref[:, None]) ** 2).mean(axis=0))
    plateau = dist[max(t0, t1 - 24): max(t0 + 1, t1 - 8)] if mode != 'final' else dist[t0 + 4: t0 + 14]
    thr = max(0.35, float(np.percentile(plateau, 90)) * 1.4) if len(plateau) else 0.6
    near = dist < thr
    def run(rng, k=4):
        for i in rng:
            if i + k <= n and near[i:i + k].all(): return i
        return None
    if mode in ('cons', 'stop', 'cluster'):
        tv = run(range(t0, n)) or (t0 + 16)
        end = max(tv, t0 + (36 if mode == 'cluster' else 16))
        end = min(end, t0 + int((0.16 if mode == 'stop' else cap) / 0.005))
        a, b = max(0, t0 - 2), end
    else:  # final: 모음이 끝나는 마지막 지점부터 끝까지
        last = None
        for i in range(t0, t1):
            if near[i:i + 3].all(): last = i
        a = (last + 3) if last is not None else t0 + 20
        b = min(n, t1 + 4, a + int(cap / 0.005))
seg = x[a * HOP: b * HOP].copy()
if sustain and mode in ('cons', 'cluster') and len(seg) > int(sr * 0.06):
    # 가운데 부분을 교차 이음으로 이어 붙여 길게 낸다
    core = seg[int(len(seg) * 0.3):]
    xf = min(len(core) // 3, int(sr * 0.03))
    out = seg.copy()
    while len(out) < sr * 0.7:
        fade = np.linspace(0, 1, xf)
        out = np.concatenate([out[:-xf], out[-xf:] * (1 - fade) + core[:xf] * fade, core[xf:]])
    seg = out
fade = min(len(seg) // 3, int(sr * 0.04))
seg[-fade:] *= np.linspace(1, 0, fade)
head = min(len(seg), int(sr * 0.005)); seg[:head] *= np.linspace(0, 1, head)
o = wave.open(dst, 'wb'); o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr)
o.writeframes((np.clip(seg, -1, 1) * 32767).astype(np.int16).tobytes())
print(f'{len(seg) / sr:.2f}')
