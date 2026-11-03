#!/usr/bin/env python3
"""Prepare deck images from raw/ into assets/.

Documentary rule: crops, resizing and ONE restrained global grade only (slight contrast + gentle saturation trim so
photographs from different phones sit together). No retouching, compositing, generative fill or object removal.
EXIF (including GPS) is not copied into the outputs.
Usage: python3 prep_images.py
"""
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
import os

HERE = os.path.dirname(os.path.abspath(__file__))
RAW, OUT = os.path.join(HERE, "raw"), os.path.join(HERE, "assets")
os.makedirs(OUT, exist_ok=True)


def grade(im, contrast=1.05, sat=0.94, bright=1.0):
    im = ImageEnhance.Contrast(im).enhance(contrast)
    im = ImageEnhance.Color(im).enhance(sat)
    return ImageEnhance.Brightness(im).enhance(bright) if bright != 1 else im


def crop_box(src, box, size, name, **g):
    im = Image.open(os.path.join(RAW, src)).convert("RGB")
    im = im.crop(box) if box else im
    im = im.resize(size, Image.LANCZOS)
    if size[0] > (box[2] - box[0] if box else im.width):  # upscaled: mild unsharp to offset softness
        im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=2))
    grade(im, **g).save(os.path.join(OUT, name), quality=88, optimize=True, progressive=True)
    print(name, size)


# 01 cover / 13 bookend: aerial of Con Ho (project-supplied, 1920x1080 master)
crop_box("cover-aerial.jpg", None, (1920, 1080), "aerial.jpg", contrast=1.04, sat=0.92)
# 04 boat landing, IMG_1612 (4032x3024) -> 16:9, keep the clouds and the hand-over of the box
crop_box("IMG_1612.jpg", (0, 470, 4032, 2738), (1920, 1080), "boat.jpg")
# 05 workshop, IMG_1696 (4032x3024) -> wide crop centred on the table and the three people
crop_box("IMG_1696.jpg", (0, 300, 4032, 2568), (1920, 1080), "workshop.jpg")
# 05 workshop, tall panel (1240x1080) keeping all three people
crop_box("IMG_1696.jpg", (560, 0, 4032, 3024), (1240, 1080), "workshop-tall.jpg")
# 06 installed station, IMG_1522 (3024x4032 portrait) -> full-height panel
crop_box("IMG_1522.jpg", (0, 0, 3024, 4032), (810, 1080), "station-tall.jpg", sat=0.96)
# 13 closing, IMG_1522 -> 16:9 band: solar panel, enclosure, person, Con Ho sign
crop_box("IMG_1522.jpg", (0, 900, 3024, 2601), (1920, 1080), "station-wide.jpg", sat=0.96)
# 03 entrance gate (800x700, project-supplied) -> tall panel
crop_box("con-ho-entrance-gate.jpg", (95, 0, 705, 700), (700, 803), "gate.jpg")
# 11 dusk river (1234x1080) -> tall panel
crop_box("sunset-tall.jpg", None, (1234, 1080), "dusk.jpg", contrast=1.0, sat=0.9)
# hardware bench shots, used small in the appendix / slide 06
for f in ["board-gateway.jpg", "board-station-water-soil.jpg", "sensor-water-ec.jpg", "sensor-soil-ec.jpg"]:
    im = Image.open(os.path.join(RAW, f)).convert("RGB"); im.thumbnail((900, 900))
    grade(im).save(os.path.join(OUT, f), quality=86, optimize=True)
# product captures and identity: copied unchanged (screenshots are not graded)
for f in ["shot-dashboard-live.jpg", "report-mobile.jpg", "horizon-wordmark.png", "frogsleap-logo-1.png"]:
    Image.open(os.path.join(RAW, f)).save(os.path.join(OUT, f))
