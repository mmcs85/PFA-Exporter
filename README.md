# PFA-Exporter
Phaser Flash Asset Exporter

Phaser flash asset exporter lets you export .fla files library symbols to a Phaser Asset document (.js) including a spritesheet atlas in (.png) with JSON metadata.

How it works:

 - Looks in the library for linked symbols and their dependencies and generates a spritesheet for referenced bitmaps.
 - Generates Phaser Asset document with document properties and symbols.

Supported features:

  - Generate atlas and metadata with linked symbols and their dependencies bitmaps.
  - Generate linked symbols and their dependecies.
  - Generate Shapes.
  - Generate Texts.
  - Generate scale and rotation transformations.
  
Not Supported features:

  - Linear and oval gradient fillColor
  - Timeline animations
