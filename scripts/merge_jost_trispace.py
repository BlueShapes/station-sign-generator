#!/usr/bin/env python3

from __future__ import annotations

import argparse
import copy
import string
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

DEFAULT_BASE = Path("src/fonts/Jost-VariableFont_wght.ttf")
DEFAULT_SOURCE = Path("src/fonts/Trispace-VariableFont_wdth,wght.ttf")
DEFAULT_OUTPUT = Path("src/fonts/JostTrispaceHybrid-600.ttf")
TRISPACE_GLYPHS = ["A", "J", "M", "N", "V", "W"]
ASCII_ALNUM = string.ascii_uppercase + string.ascii_lowercase + string.digits
TRISPACE_SCALE = 0.5


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a 600-weight hybrid font from Jost and Trispace.",
    )
    parser.add_argument("--base", type=Path, default=DEFAULT_BASE)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser.parse_args()


def instantiate_font(path: Path, axis_values: dict[str, float]) -> TTFont:
    font = TTFont(path)
    instantiateVariableFont(font, axis_values, inplace=True)
    return font


def scale_glyph(glyph, scale: float):
    if glyph.isComposite():
        for component in glyph.components:
            component.x = round(component.x * scale)
            component.y = round(component.y * scale)
            if hasattr(component, "transform") and component.transform:
                xx, xy, yx, yy = component.transform
                component.transform = (xx * scale, xy * scale, yx * scale, yy * scale)
    elif glyph.numberOfContours > 0:
        coordinates = glyph.coordinates
        coordinates.scale((scale, scale))
        glyph.coordinates = coordinates
    glyph.recalcBounds(None)
    return glyph


def replace_glyphs(base: TTFont, source: TTFont, glyph_names: list[str]) -> None:
    base_cmap = base.getBestCmap()
    source_cmap = source.getBestCmap()

    for glyph_name in glyph_names:
        if glyph_name not in base.getGlyphOrder():
            raise ValueError(f"Base font does not contain glyph '{glyph_name}'")
        if glyph_name not in source.getGlyphOrder():
            raise ValueError(f"Source font does not contain glyph '{glyph_name}'")
        if base_cmap.get(ord(glyph_name)) != glyph_name:
            raise ValueError(f"Base cmap does not map '{glyph_name}' to '{glyph_name}'")
        if source_cmap.get(ord(glyph_name)) != glyph_name:
            raise ValueError(f"Source cmap does not map '{glyph_name}' to '{glyph_name}'")

        glyph = copy.deepcopy(source["glyf"][glyph_name])
        glyph = scale_glyph(glyph, TRISPACE_SCALE)
        base["glyf"][glyph_name] = glyph

        advance_width, left_side_bearing = source["hmtx"].metrics[glyph_name]
        base["hmtx"].metrics[glyph_name] = (
            round(advance_width * TRISPACE_SCALE),
            round(left_side_bearing * TRISPACE_SCALE),
        )


def subset_ascii_alnum(font: TTFont) -> None:
    options = Options()
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_outline = True

    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=[ord(ch) for ch in ASCII_ALNUM])
    subsetter.subset(font)


def set_names(font: TTFont) -> None:
    family = "JostTrispaceHybrid"
    subfamily = "SemiBold"
    full_name = "JostTrispaceHybrid SemiBold"
    postscript_name = "JostTrispaceHybrid-SemiBold"

    for platform_id, enc_id, lang_id in ((3, 1, 0x409), (1, 0, 0)):
        font["name"].setName(family, 1, platform_id, enc_id, lang_id)
        font["name"].setName(subfamily, 2, platform_id, enc_id, lang_id)
        font["name"].setName(full_name, 4, platform_id, enc_id, lang_id)
        font["name"].setName(postscript_name, 6, platform_id, enc_id, lang_id)

    if "OS/2" in font:
        font["OS/2"].usWeightClass = 600


def main() -> None:
    args = parse_args()

    base_font = instantiate_font(args.base, {"wght": 600})
    source_font = instantiate_font(args.source, {"wght": 600, "wdth": 100})

    replace_glyphs(base_font, source_font, TRISPACE_GLYPHS)
    subset_ascii_alnum(base_font)
    set_names(base_font)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    base_font.save(args.output)
    print(f"Created {args.output}")
    print("Replaced glyphs:", ", ".join(TRISPACE_GLYPHS))
    print("Subset:", ASCII_ALNUM)


if __name__ == "__main__":
    main()
