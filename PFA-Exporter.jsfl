/**
* @desc         Phaser Flash Asset Exporter
* @version      0.3.8 - June 15th 2016
* @author       Mário Silva <mmcs@outlook.pt>
* @copyright    2016 mmcs85
* @license      {@link https://github.com/mmcs85/PFA-Exporter/blob/master/LICENSE|MIT License}
*/

var document = fl.getDocumentDOM();
var libItems = document.library.items;
var sse = new SpriteSheetExporter;
var exportedItems = [];

//#region Utils
var isFillEqual = function (fill1, fill2) {

    if (fill1 == fill2) return true;
    if (fill1 == null || fill2 == null) return false;
    if (fill1.style != fill2.style) return false;

    var matrix = fill1.matrix;
    switch (fill1.style) {
        case "bitmap":
            if (fill1.bitmapPath != fill2.bitmapPath ||
               fill1.matrix.a != fill2.matrix.a ||
               fill1.matrix.b != fill2.matrix.b ||
               fill1.matrix.c != fill2.matrix.c ||
               fill1.matrix.d != fill2.matrix.d ||
               fill1.matrix.tx != fill2.matrix.tx ||
               fill1.matrix.ty != fill2.matrix.ty) return false;
            break;
        case "solid":
            if (fill1.color != fill2.color) return false;
            break;
        case "linearGradient":
            if (fill1.color != fill2.color ||
               fill1.matrix.a != fill2.matrix.a ||
               fill1.matrix.b != fill2.matrix.b ||
               fill1.matrix.c != fill2.matrix.c ||
               fill1.matrix.d != fill2.matrix.d ||
               fill1.matrix.tx != fill2.matrix.tx ||
               fill1.matrix.ty != fill2.matrix.ty) return false;
            break;
        case "radialGradient":
            //check http://rectangleworld.com/blog/archives/169
            /*
            out += matrix.a + ","+
                      matrix.b + ","+
                      matrix.c + ","+
                      matrix.d + ","+
                      matrix.tx + ","+
                      matrix.ty + "\n";*/
            break;
    }

    return true;
}
//#endregion

//#region Spritesheet Exporter Utils

var scanElementForBitmaps = function (element) {
    switch (element.elementType) {
        case "shape":
            if (element.isGroup) {
                for (var m = 0; m < element.members.length; m++) {
                    var member = element.members[m];
                    scanElementForBitmaps(member);
                }
            }
            for (var c = 0; c < element.contours.length; c++) {
                var contour = element.contours[c];
                if (contour.fill.style == "bitmap") {
                    addSpriteSheetItem(libItems[document.library.findItemIndex(contour.fill.bitmapPath)]);
                }
            }
            break;
        case "instance":
            addSpriteSheetItem(element.libraryItem);
    }
}

var scanSymbolForBitmaps = function (symbol) {
    var timeline = symbol.timeline;
    for (var l = 0; l < timeline.layers.length; l++) {
        var layer = timeline.layers[l];
        for (var f = 0; f < layer.frames.length; f++) {
            var frame = layer.frames[f];
            for (var e = 0; e < frame.elements.length; e++) {
                var element = frame.elements[e];
                scanElementForBitmaps(element);
            }
        }
    }
}

var addSpriteSheetItem = function (item) {
    if (exportedItems.indexOf(item.name) != -1)
        return;

    switch (item.itemType) {
        case "bitmap":
            sse.addBitmap(item);
            exportedItems.push(item.name);
            break;
        case "graphic":
        case "movie clip":
            scanSymbolForBitmaps(item);
            exportedItems.push(item.name);
            break;
    }
}

//#endregion

//#region Generator Utils

var generateBitmapConstructor = function (fileName, item) {
    var out = "";
    var symbolName = item.name.substr(item.name.lastIndexOf("/") + 1, item.name.length);
    out = "lib." + symbolName.replace(/\.|\-/g, "") + " = function(game, x, y){\n" +
		  "    return game.make.sprite(x, y, '" + fileName + "', '" + symbolName + "');\n" +
		  "}\n\n";
    return out;
}

var generateElementConstructor = function (fileName, element) {
    var out = "";
    switch (element.elementType) {
        case "shape":
            if (element.isGroup) {
                for (var m = 0; m < element.members.length; m++) {
                    var member = element.members[m];
                    out += generateElementConstructor(fileName, member);
                }
            }
            for (var c = 0; c < element.contours.length; c++) {
                var contour = element.contours[c];
                if (contour.fill.style == "bitmap") {
                    out += generateItem(fileName, libItems[document.library.findItemIndex(contour.fill.bitmapPath)]);
                }
            }
            break;
        case "instance":
            out += generateItem(fileName, element.libraryItem);
            break;
    }
    return out;
}

var generateContourStyle = function (fill, isStrokeStyle, centerPoint) {
    var out = "";
    var matrix = fill.matrix;
    //Property; a string that specifies the fill style. Acceptable values are "bitmap", "solid", "linearGradient", "radialGradient", and "noFill".
    //If this value is "linearGradient" or "radialGradient", the fill.colorArray and fill.posArray properties are also available. 
    //If this value is "bitmap", the fill.bitmapIsClipped and fill.bitmapPath properties are also available.		
    switch (fill.style) {
        case "bitmap":
            //TODO does not support pattern repetition transformations
            var bitmapItem = libItems[document.library.findItemIndex(fill.bitmapPath)];
            var bitmapWidth = bitmapItem.hPixels;
            var bitmapHeight = bitmapItem.vPixels;
            var bitmapName = bitmapItem.name.substr(bitmapItem.name.lastIndexOf("/") + 1, bitmapItem.name.length);
            var t2dMat = [matrix.a / 20, matrix.b / 20, matrix.c / 20, matrix.d / 20];
            var tx = -t2dMat[0] * bitmapWidth / 2 - t2dMat[2] * bitmapHeight / 2 + bitmapWidth / 2;
            var ty = -t2dMat[1] * bitmapWidth / 2 - t2dMat[3] * bitmapHeight / 2 + bitmapHeight / 2;
            var matrixArray = [t2dMat[0], t2dMat[1], t2dMat[2], t2dMat[3], tx, ty];

            out += "        var " + bitmapName + " = game.make.renderTexture(" + bitmapWidth + "," + bitmapHeight + ");\n" +
                   "        " + bitmapName + ".render(lib." + bitmapName + "(game), new Phaser.Matrix().setTo(" + matrixArray.join() + "));\n";

            if (isStrokeStyle) {
                out += "        ctx.strokeStyle = ctx.createPattern(" + bitmapName + ".getCanvas(), 'repeat');\n";
            }
            else {
                out += "        ctx.fillStyle = ctx.createPattern(" + bitmapName + ".getCanvas(), 'repeat');\n";
            }
            break;
        case "solid":
            if (isStrokeStyle) {
                out += "        ctx.strokeStyle = '" + fill.color + "';\n";
            }
            else {
                out += "        ctx.fillStyle = '" + fill.color + "';\n";
            }
            break;
        case "linearGradient":
            var t2dMat = [matrix.a, matrix.b, matrix.c, matrix.d];
            var tx = (-t2dMat[0] - t2dMat[2]) * 819.2;
            var ty = (-t2dMat[1] - t2dMat[3]) * 819.2;
            var gradPoints = [
                t2dMat[2] * 819.2 + tx, //x0
                t2dMat[3] * 819.2 + ty,  //y0
                t2dMat[0] * 1638.4 + t2dMat[2] * 819.2 + tx, //x1
                t2dMat[1] * 1638.4 + t2dMat[3] * 819.2 + ty //y1
            ];

            out += "//" + matrix.a + "," +
                      matrix.b + "," +
                      matrix.c + "," +
                      matrix.d + "," +
                      matrix.tx + "," +
                      matrix.ty + "\n";

            out += "        gradient = ctx.createLinearGradient(" + gradPoints.join() + ");\n";
            for (var g = 0; g < fill.colorArray.length; g++) {
                out += "        gradient.addColorStop(" + fill.posArray[g] / 255 + ", '" + fill.colorArray[g] + "');\n";
            }
            if (isStrokeStyle) {
                out += "        ctx.strokeStyle = gradient;\n";
            }
            else {
                out += "        ctx.fillStyle = gradient;\n";
            }
            break;
        case "radialGradient":
            //check http://rectangleworld.com/blog/archives/169
            /*
            out += matrix.a + ","+
                      matrix.b + ","+
                      matrix.c + ","+
                      matrix.d + ","+
                      matrix.tx + ","+
                      matrix.ty + "\n";*/
            break;
    }

    return out;
}

var generatePolyPoint = function (shape, he, first) {
    var out = "",
		e = he.getEdge(),
		vertice = he.getVertex();

    out += first ? "{" : ",{";
    out += "x:" + vertice.x + ", y:" + vertice.y;
    if (!first && !e.isLine) {
        var cubicPoints = shape.getCubicSegmentPoints(e.cubicSegmentIndex);
        out += ",bc: [" +
			 cubicPoints[2].x + "," +
			 cubicPoints[2].y + "," +
			 cubicPoints[1].x + "," +
			 cubicPoints[1].y +
			 "]";
    }
    out += "}";
    return out;
}

var generatePolygonFill = function (shape, interior, heArray) {
    var out = "";
    out += "        drawPolygon(ctx, [";
    for (var i = 0; i < heArray.length; i++) {
        var he = heArray[i];
        out += generatePolyPoint(shape, he, i == 0);
    }
    if (interior) {
        out += generatePolyPoint(shape, heArray[0], false);
    }
    out += "]);\n" +
           "        ctx.fill();\n";
    return out;
}

var generatePolygonStroke = function (shape, interior, heArray) {
    var out = "";
    var strokeShapeFill = null;
    for (var i = 0; i < heArray.length; i++) {
        var he = heArray[i];
        var e = he.getEdge();

        if (e.stroke.style == "noStroke") {
            return out;
        }

        if (!isFillEqual(strokeShapeFill, e.stroke.shapeFill)) {
            strokeShapeFill = e.stroke.shapeFill;

            if (i > 0) {
                out += "]);\n" +
                       "        ctx.stroke();\n";
            }

            if (e.stroke.shapeFill != null) {
                out += generateContourStyle(strokeShapeFill, true, null);
                out += "        ctx.lineWidth = " + e.stroke.thickness + ";\n";
            }

            if (i < heArray.length - 1) {
                out += "        drawPolygon(ctx, [";
            }
            out += generatePolyPoint(shape, he, true);
        }
        else {
            out += generatePolyPoint(shape, he, false);
        }
    }

    if (interior) {
        out += generatePolyPoint(shape, heArray[0], false);
    }

    out += "]);\n" +
           "        ctx.stroke();\n";
    return out;
}

var generateContour = function (shape, contour) {
    var out = "";

    var he = contour.getHalfEdge();
    var iStart = he.id;
    var id = 0;
    var centerPoint = null;
    var heArray = [];
    while (id != iStart) {
        //TODO calculate center mass point
        heArray.push(he);
        he = he.getNext();
        id = he.id;
    }

    out += generateContourStyle(contour.fill, false, centerPoint) +
           generatePolygonFill(shape, contour.interior, heArray);

    out += generatePolygonStroke(shape, contour.interior, heArray);

    return out;
}

var generateShape = function (shape, instanceName) {
    var out = "";
    var instanceShapeBd = instanceName + "BD";

    out += "    var " + instanceShapeBd + " = game.cache.getBitmapData('" + instanceShapeBd + "');\n" +
		   "    if(!" + instanceShapeBd + ") {\n" +
		   "        " + instanceShapeBd + " = game.make.bitmapData(256, 256, '" + instanceShapeBd + "', true);\n" +
		   "        var ctx = " + instanceShapeBd + ".ctx;\n";

    for (var c = 0; c < shape.contours.length; c++) {
        var contour = shape.contours[c];
        var he = contour.getHalfEdge();

        if (contour.fill.style == "noFill")
            continue;

        out += "//interior:" + contour.interior + "\n";
        out += "//contour.fill.style:" + contour.fill.style + "\n";
        out += "//he.getEdge().stroke.style:" + (he.getEdge().stroke ? he.getEdge().stroke.style : "") + "\n";
        out += "//he.getEdge().stroke.shapeFill.color:" + (he.getEdge().stroke && he.getEdge().stroke.shapeFill ? he.getEdge().stroke.shapeFill.color : "") + "\n";
        out += "//he.getEdge().stroke.shapeFill.style:" + (he.getEdge().stroke && he.getEdge().stroke.shapeFill ? he.getEdge().stroke.shapeFill.style : "") + "\n";

        out += generateContour(shape, contour);
    }

    out += "    }\n" +
		   "    var " + instanceName + " = game.make.sprite(0, 0, " + instanceShapeBd + ");\n";

    return out;
}

var generateText = function (text, instanceName) {
    var out = "";
    var fontWeight = "";

    if (text.getTextAttr("bold"))
        fontWeight = "bold";
    else if (text.getTextAttr("italic"))
        fontWeight = "italic";

    out += "    var " +
		 instanceName +
		 " = game.make.text(" +
		 text.x +
		 "," +
		 text.y +
		 ",'" +
		 text.getTextString() +
		 "'," +
		 "{" +
		 "font:\"" + fontWeight + " " + text.getTextAttr("size") + "pt '" + text.getTextAttr("face") +
		 "'\"," +
		 "fill:'" + text.getTextAttr("fillColor") +
		 "'\," +
		 "strokeThickness:2" +
	 "});\n";

    return out;
}

var generateInstance = function (instance, instanceName, symbolName) {
    var out = "";
    out = "    var " + instanceName + " = lib." + symbolName + "(game," + instance.x + "," + instance.y + ");\n";
    return out;
}

var generateTransformations = function (element, instanceName) {
    var out = "";
    if (element.scaleX != 1 || element.scaleY != 1) {
        out += "    " + instanceName +
			 ".scale.set(" + element.scaleX + "," + element.scaleY + ");\n";
    }

    if (element.rotation) {
        out += "    " + instanceName +
			 ".angle = " + element.rotation + ";\n";
    }
    return out;
}

var generateElement = function (element, groupInstances, symbolName) {
    var out = "";
    switch (element.elementType) {
        case "shape":
            if (element.contours.length > 0) {
                var instanceName = element.name || (symbolName + "_shape" + (groupInstances.length + 1));
                out += generateShape(element, instanceName) +
					 generateTransformations(element, instanceName);

                groupInstances.push(instanceName);
            }
            //out += "//test element.isGroup: " + element.isGroup + ", members.length:"+ element.members.length + "\n";
            if (element.isGroup && element.members.length > 0) {
                for (var m = 0; m < element.members.length; m++) {
                    var member = element.members[m];
                    out += generateElement(member, groupInstances, symbolName);
                }
            }
            break;
        case "text":
            var instanceName = element.name || (symbolName + "text" + (groupInstances.length + 1));
            out += generateText(element, instanceName) +
				 generateTransformations(element, instanceName);

            groupInstances.push(instanceName);
            break;
        case "instance":
            var symbolName = element.libraryItem.name.substr(element.libraryItem.name.lastIndexOf("/") + 1, element.libraryItem.name.length).replace(/\.|\-/g, "");
            var instanceName = element.name || ("instance" + (groupInstances.length + 1));
            out += generateInstance(element, instanceName, symbolName) +
				 generateTransformations(element, instanceName);

            groupInstances.push(instanceName);
            break;
    }

    return out;
}

var generateSymbol = function (fileName, symbol) {
    var timeline = symbol.timeline;
    var out = "";

    // generate referenced symbol definitions first
    for (var l = 0; l < timeline.layers.length; l++) {
        var layer = timeline.layers[l];
        for (var f = 0; f < layer.frames.length; f++) {
            var frame = layer.frames[f];
            for (var e = 0; e < frame.elements.length; e++) {
                var element = frame.elements[e];
                out += generateElementConstructor(fileName, element);
            }
        }
    }

    // generate symbol
    var symbolName = symbol.name.substr(symbol.name.lastIndexOf("/") + 1, symbol.name.length);
    var groupInstances = [];

    out += "lib." + symbolName.replace(/\.|\-/g, "") + " = function(game, x, y){\n" +
         "    var gradient = null;\n" +
		 "    var group = game.make.group();\n" +
		 "    group.x = x;\n" +
		 "    group.y = y;\n";

    for (var l = 0; l < timeline.layers.length; l++) {
        var layer = timeline.layers[l];
        for (var f = 0; f < layer.frames.length; f++) {
            var frame = layer.frames[f];
            //out += "//layer.animationtype: " + layer.animationType + "\n";
            for (var e = 0; e < frame.elements.length; e++) {
                var element = frame.elements[e];
                //out += "//element.name: " + element.name + "\n";
                out += generateElement(element, groupInstances, symbolName);
                previousElement = element;
            }
        }
    }

    if (groupInstances.length > 0) {
        out += "    group.addMultiple([" + groupInstances.join() + "]);\n";
    }

    out += "    return group;\n" +
	 "}\n\n";

    return out;
}

var generateItem = function (fileName, item) {
    if (exportedItems.indexOf(item.name) != -1)
        return "";

    switch (item.itemType) {
        case "bitmap":
            exportedItems.push(item.name);
            return generateBitmapConstructor(fileName, item);
        case "graphic":
        case "movie clip":
            exportedItems.push(item.name);
            return generateSymbol(fileName, item);
    }

    return "";
}

var generateSymbols = function (fileName) {
    var out = "";
    exportedItems.length = 0;
    for (var i = 0; i < libItems.length; i++) {
        var item = libItems[i];

        // ignore items without linkage unless is referenced as instance in other item
        if (!item.linkageClassName)
            continue;

        out += generateItem(fileName, item);
    }
    return out;
};

var generateAssetFile = function (fileName) {
    var out = "// Generated by PFA-Exporter v0.3.8 at " + new Date().toUTCString() + "\n\n";

    out += "(function (lib) {	\n\n" +
		 "var drawPolygon = function(ctx, poly) {\n" +
		 "   if(poly.length < 1) return;\n" +
		 "   ctx.beginPath();\n" +
		 "   ctx.moveTo(poly[0].x, poly[0].y);\n" +
		 "   for( var i=1 ; i < poly.length ; i++ ) {\n" +
		 "      var p = poly[i];\n" +
		 "      if(!p.bc)\n" +
		 "          ctx.lineTo(p.x , p.y);\n" +
		 "      else\n" +
		 "          ctx.bezierCurveTo(p.bc[0],p.bc[1],p.bc[2],p.bc[3], p.x, p.y);\n" +
		 "   }\n" +
		 "}\n" +
		 "// library properties:\n" +
		 "lib.properties = {\n" +
		 "	width:" + document.width + ",\n" +
		 "	height:" + document.height + ",\n" +
		 "	fps:" + document.frameRate + ",\n" +
		 "	color:'" + document.backgroundColor + "',\n" +
		 "	atlas: {\n" +
		 "		name:'" + fileName + "',\n" +
		 "		image:'" + fileName + ".png',\n" +
		 "		metadata:'" + fileName + ".json',\n" +
		 "	}\n" +
		 "};\n\n" +
		 "// symbols:\n" +
		 generateSymbols(fileName) +
	 "})(lib = lib||{});\n" +
	 "var lib;";

    return out;
}

//#endregion

//#region Main

var main = function () {
    var fileURL = fl.browseForFileURL("save", "Select a JS", "Phaser Asset Document (*.js)", "js");

    if (!fileURL)
        return;

    for (var i = 0; i < libItems.length; i++) {
        var item = libItems[i];
        // ignore items without linkage unless is referenced as instance in other item
        if (!item.linkageClassName)
            continue;

        addSpriteSheetItem(item);
    }

    var fileNoExtURL = fileURL.substr(0, fileURL.length - 3);
    var fileName = fileNoExtURL.substr(fileNoExtURL.lastIndexOf("/") + 1, fileNoExtURL.length);

    // save phaser flash asset file
    fl.outputPanel.clear();
    fl.trace(generateAssetFile(fileName));
    fl.outputPanel.save(fileURL);

    // save atlas and metadata
    sse.autoSize = true;
    sse.allowRotate = true;
    sse.layoutFormat = "JSON-Array";
    sse.exportSpriteSheet(fileNoExtURL, { format: "png", bitDepth: 32, backgroundColor: "#00000000" });

    fl.trace("exported assets successfully.");
}

main();

//#endregion
