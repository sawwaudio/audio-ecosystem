#!/usr/bin/env python3
"""Objective acoustic descriptors + duplicate fingerprints for the 32 recordings.

Uses the best available source per recording (PCM decoded from original, else compat MP3).
Descriptors (all on a 22.05 kHz mono analysis copy, never written back):
  flatness   : median spectral flatness (0 tonal … 1 noise)
  tonality   : median ratio of strongest STFT bin to frame energy
  envCV      : coefficient of variation of the 20 ms RMS envelope (low = sustained)
  pulseHz    : dominant envelope modulation rate 1–40 Hz, pulseStrength its autocorrelation peak
  centroidHz : median spectral centroid
  activity   : fraction of frames above (median + 6 dB)
Fingerprint: 64-band log-mel envelope sequence (2 Hz), compared by max normalized x-corr.
"""
import json, subprocess, sys
import numpy as np

SR = 22050


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-map', '0:a:0', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, '<f4').astype(np.float64)


def stft_mag(x, n=1024, hop=512):
    w = np.hanning(n)
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * w
    return np.abs(np.fft.rfft(frames, axis=1)) + 1e-12


def features(x):
    S = stft_mag(x)
    P = S ** 2
    flat = np.exp(np.log(P).mean(1)) / P.mean(1)
    tonal = P.max(1) / P.sum(1)
    freqs = np.fft.rfftfreq(1024, 1 / SR)
    cent = (P * freqs).sum(1) / P.sum(1)
    hop = int(SR * 0.005)
    env = np.sqrt(np.convolve(x ** 2, np.ones(4 * hop) / (4 * hop), 'same')[::hop] + 1e-12)  # 200 Hz envelope
    e = env - env.mean()
    ac = np.correlate(e, e, 'full')[len(e) - 1:]
    ac /= ac[0] + 1e-12
    fs = 1 / 0.005
    lo, hi = int(fs / 40), int(fs / 1)
    k = lo + 1 + int(np.argmax(ac[lo + 1:hi]))
    if k <= lo + 1 or not (ac[k] >= ac[k - 1] and ac[k] >= ac[k + 1]):  # no interior peak → no reliable pulse
        k = None
    db = 20 * np.log10(env)
    return dict(flatness=float(np.median(flat)), tonality=float(np.median(tonal)), envCV=float(env.std() / env.mean()),
                pulseHz=(float(fs / k) if k else None), pulseStrength=(float(ac[k]) if k else 0.0), centroidHz=float(np.median(cent)),
                activity=float((db > np.median(db) + 6).mean()))


def fingerprint(x):
    S = stft_mag(x, 2048, 1024)
    idx = np.unique(np.round(np.geomspace(6, S.shape[1] - 1, 66)).astype(int))  # bin edges, every band >= 1 bin
    bands = np.stack([S[:, a:b].mean(1) for a, b in zip(idx[:-1], idx[1:])], 1)
    L = np.log(bands + 1e-9)
    L = L - L.mean(0)
    return L / (np.linalg.norm(L, axis=1, keepdims=True) + 1e-9)


def max_xcorr(a, b):
    """max over lags of mean frame cosine similarity (overlap >= 5 s)."""
    best = -1
    n = min(len(a), len(b))
    minov = 108  # ~5 s at 1024 hop / 22050
    for lag in range(-(len(b) - minov), len(a) - minov + 1, 2):
        A = a[max(0, lag):]; B = b[max(0, -lag):]
        m = min(len(A), len(B))
        if m < minov: continue
        s = float((A[:m] * B[:m]).sum(1).mean())
        best = max(best, s)
    return best


def classify(f, kind):
    """Provisional sound roles from descriptors (documented thresholds)."""
    roles = []
    if kind == 'landscape' and f['envCV'] < 0.8: roles.append('Atmosphere')
    if f['envCV'] < 0.5 and kind != 'landscape': roles.append('Drone')
    if f['pulseStrength'] > 0.5 and f['pulseHz'] and 1.5 <= f['pulseHz'] < 35: roles.append('Pulse')
    if f['tonality'] > 0.07 and f['envCV'] > 0.8 and f['flatness'] < 0.05: roles.append('Melody')
    if f['envCV'] > 1.8 and f['flatness'] > 0.1: roles.append('Percussion')
    if f['flatness'] > 0.15 or kind == 'mixed': roles.append('Texture')
    return roles or ['Texture']


if __name__ == '__main__':
    man = json.load(open('dist/data/audio_manifest.json'))
    recs = json.load(open('recordings.json'))
    out, fps = {}, {}
    for r in recs:
        m = man['recordings'][r['id']]
        e = m.get('pcm') or m['compat']
        path = 'dist/' + (e['parts'][0]['path'] if 'parts' in e else e['path'])
        if 'parts' in e and len(e['parts']) > 1:
            x = np.concatenate([load('dist/' + p['path']) for p in e['parts']])
        else:
            x = load(path)
        f = features(x)
        f['autoRoles'] = classify(f, r['kind'])
        f['analysedFrom'] = 'pcm' if 'pcm' in m else 'compat'
        out[r['id']] = f
        fps[r['id']] = fingerprint(x)
        print(f"{r['id']:24s} flat={f['flatness']:.3f} ton={f['tonality']:.3f} envCV={f['envCV']:.2f} pulse={(f['pulseHz'] or 0):.1f}Hz/{f['pulseStrength']:.2f} cent={f['centroidHz']:.0f} -> {f['autoRoles']}", flush=True)
    ids = list(fps)
    pairs = []
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            s = max_xcorr(fps[ids[i]], fps[ids[j]])
            pairs.append((s, ids[i], ids[j]))
    pairs.sort(reverse=True)
    print('top similarity pairs:')
    for p in pairs[:8]: print(f'  {p[0]:.3f} {p[1]} ~ {p[2]}')
    json.dump({'features': out, 'similarityTop': [dict(score=round(s, 4), a=a, b=b) for s, a, b in pairs[:15]],
               'method': __doc__}, open('work/acoustic_features.json', 'w'), ensure_ascii=False, indent=1)
