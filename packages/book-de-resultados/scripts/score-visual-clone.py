import json
import math
import pathlib
import sys

import numpy as np
from PIL import Image, ImageChops


def load_image(path_str):
    image = Image.open(path_str).convert('RGB')
    return image


def resize_to_match(reference, current):
    if reference.size == current.size:
        return reference, current
    return reference, current.resize(reference.size)


def image_to_array(image):
    return np.asarray(image, dtype=np.float64)


def grayscale_array(image):
    return np.asarray(image.convert('L'), dtype=np.float64)


def compute_ssim(reference, current):
    reference_gray = grayscale_array(reference)
    current_gray = grayscale_array(current)
    data_range = 255.0
    c1 = (0.01 * data_range) ** 2
    c2 = (0.03 * data_range) ** 2
    mu_x = reference_gray.mean()
    mu_y = current_gray.mean()
    sigma_x = reference_gray.var()
    sigma_y = current_gray.var()
    sigma_xy = ((reference_gray - mu_x) * (current_gray - mu_y)).mean()
    numerator = (2 * mu_x * mu_y + c1) * (2 * sigma_xy + c2)
    denominator = (mu_x ** 2 + mu_y ** 2 + c1) * (sigma_x + sigma_y + c2)
    if denominator == 0:
        return 1.0
    return max(0.0, min(1.0, numerator / denominator))


def compute_pixel_similarity(reference, current, threshold=18):
    diff = ImageChops.difference(reference, current)
    gray = np.asarray(diff.convert('L'), dtype=np.float64)
    mismatch_mask = gray > threshold
    mismatch_ratio = float(mismatch_mask.sum()) / float(gray.size)
    mean_abs_error = float(gray.mean()) / 255.0
    return {
        'mismatchRatio': mismatch_ratio,
        'meanAbsoluteError': mean_abs_error,
        'score': max(0.0, 1.0 - mismatch_ratio),
        'diffImage': diff,
    }


def compute_box_similarity(reference_box, current_box):
    deltas = [
        abs(reference_box['x'] - current_box['x']),
        abs(reference_box['y'] - current_box['y']),
        abs(reference_box['width'] - current_box['width']),
        abs(reference_box['height'] - current_box['height']),
    ]
    penalty = sum(deltas) / 4.0
    return max(0.0, 1.0 - penalty)


def clip_from_box(image, box):
    width, height = image.size
    left = max(0, min(width, int(round(box['x'] * width))))
    top = max(0, min(height, int(round(box['y'] * height))))
    right = max(left + 1, min(width, int(round((box['x'] + box['width']) * width))))
    bottom = max(top + 1, min(height, int(round((box['y'] + box['height']) * height))))
    return image.crop((left, top, right, bottom))


def ensure_parent(path_str):
    pathlib.Path(path_str).parent.mkdir(parents=True, exist_ok=True)


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: score-visual-clone.py <manifest.json>')

    manifest_path = pathlib.Path(sys.argv[1])
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

    reference_image = load_image(manifest['artifacts']['referenceImage'])
    current_image = load_image(manifest['artifacts']['currentImage'])
    reference_image, current_image = resize_to_match(reference_image, current_image)

    global_pixels = compute_pixel_similarity(reference_image, current_image)
    global_ssim = compute_ssim(reference_image, current_image)

    region_results = []
    weighted_pixel = 0.0
    weighted_ssim = 0.0
    weighted_layout = 0.0
    total_weight = 0.0

    for region in manifest['regions']:
        current_box = manifest['currentRegions'].get(region['id'])
        if not current_box:
            region_results.append({
                'id': region['id'],
                'label': region['label'],
                'weight': region['weight'],
                'missing': True,
                'pixelScore': 0.0,
                'ssim': 0.0,
                'layoutScore': 0.0,
                'weightedScore': 0.0,
            })
            total_weight += region['weight']
            continue

        reference_crop = clip_from_box(reference_image, region['refBox'])
        current_crop = clip_from_box(current_image, current_box)
        reference_crop, current_crop = resize_to_match(reference_crop, current_crop)

        pixel_result = compute_pixel_similarity(reference_crop, current_crop)
        ssim_score = compute_ssim(reference_crop, current_crop)
        layout_score = compute_box_similarity(region['refBox'], current_box)
        weighted_score = (0.35 * pixel_result['score']) + (0.30 * ssim_score) + (0.35 * layout_score)

        region_results.append({
            'id': region['id'],
            'label': region['label'],
            'weight': region['weight'],
            'missing': False,
            'pixelScore': round(pixel_result['score'], 4),
            'pixelMismatchRatio': round(pixel_result['mismatchRatio'], 4),
            'ssim': round(ssim_score, 4),
            'layoutScore': round(layout_score, 4),
            'weightedScore': round(weighted_score, 4),
            'referenceBox': region['refBox'],
            'currentBox': current_box,
        })
        weighted_pixel += pixel_result['score'] * region['weight']
        weighted_ssim += ssim_score * region['weight']
        weighted_layout += layout_score * region['weight']
        total_weight += region['weight']

        diff_path = pathlib.Path(manifest['artifacts']['diffDir']) / f"region-{region['id']}.png"
        ensure_parent(str(diff_path))
        pixel_result['diffImage'].save(diff_path)

    if total_weight == 0:
        total_weight = 1.0

    aggregated_pixel = weighted_pixel / total_weight
    aggregated_ssim = weighted_ssim / total_weight
    aggregated_layout = weighted_layout / total_weight
    final_score = (0.35 * aggregated_pixel) + (0.30 * aggregated_ssim) + (0.35 * aggregated_layout)

    global_diff_path = pathlib.Path(manifest['artifacts']['diffDir']) / 'global-diff.png'
    ensure_parent(str(global_diff_path))
    global_pixels['diffImage'].save(global_diff_path)

    severe_regions = sorted(region_results, key=lambda item: item['weightedScore'])[:3]

    results = {
        'experimentId': manifest['experimentId'],
        'generatedAt': manifest['generatedAt'],
        'page': manifest['page'],
        'artifacts': manifest['artifacts'],
        'global': {
            'pixelScore': round(global_pixels['score'], 4),
            'pixelMismatchRatio': round(global_pixels['mismatchRatio'], 4),
            'meanAbsoluteError': round(global_pixels['meanAbsoluteError'], 4),
            'ssim': round(global_ssim, 4),
            'layoutScore': round(aggregated_layout, 4),
            'weightedPixelScore': round(aggregated_pixel, 4),
            'weightedSsimScore': round(aggregated_ssim, 4),
            'finalScore': round(final_score, 4),
        },
        'regions': region_results,
        'priorityFindings': [
            {
                'regionId': region['id'],
                'label': region['label'],
                'score': region['weightedScore'],
                'reason': 'Região com menor aderência combinada de pixel, estrutura e layout.' if not region['missing'] else 'Região não localizada no HTML capturado.',
            }
            for region in severe_regions
        ],
    }

    output_path = pathlib.Path(manifest['artifacts']['metricsFile'])
    ensure_parent(str(output_path))
    output_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()