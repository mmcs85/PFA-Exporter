/**
* @desc         Phaser Flash Asset Exporter
* @version      0.3.6 - May 15th 2016
* @author       Mário Silva <mmcs@outlook.pt>
* @copyright    2016 mmcs85
* @license      {@link https://github.com/mmcs85/PFA-Exporter/blob/master/LICENSE|MIT License}
*/

var document = fl.getDocumentDOM();
var libItems = document.library.items;
var sse = new SpriteSheetExporter;
var exportedItems = [];

/* Spritesheet Exporter Utils */

var scanElementForBitmaps = function(element) {
	switch(element.elementType) {
		case "shape":
			if(element.isGroup) {
				for(var m = 0; m < element.members.length; m++) {
					var member = element.members[m];
					scanElementForBitmaps(member);
				}
			}
			for(var c = 0; c < element.contours.length; c++) {
				var contour = element.contours[c];						
				if(contour.fill.style == "bitmap") {
					addSpriteSheetItem(libItems[document.library.findItemIndex(contour.fill.bitmapPath)]);
				}
			}
			break;
		case "instance":
			addSpriteSheetItem(element.libraryItem);
	}
}

var scanSymbolForBitmaps = function(symbol) {
	var timeline = symbol.timeline;
	for(var l = 0; l < timeline.layers.length; l++) {
		var layer = timeline.layers[l];
		for(var f = 0; f < layer.frames.length; f++) {
			var frame = layer.frames[f];
			for(var e = 0; e < frame.elements.length; e++) {
				var element = frame.elements[e];
				scanElementForBitmaps(element);
			}
		}
	}
}

var addSpriteSheetItem = function(item) {
	if(exportedItems.indexOf(item.name) != -1)
		return;
	
	switch(item.itemType) {		
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

/* Generator Utils */

var generateBitmapConstructor = function(fileName, item) {
	var out = "";
	var symbolName = item.name.substr(item.name.lastIndexOf("/")+1, item.name.length);
	out = out.concat("lib.").concat(symbolName.replace(/\.|\-/g, "")).concat(" = function(game, x, y){\n")
		.concat("    return game.make.sprite(x, y, '").concat(fileName).concat("', '").concat(symbolName).concat("');\n")
		.concat("}\n\n");
	return out;
}

var generateElementConstructor = function(fileName, element) {	
	var out = "";
	switch(element.elementType) {
		case "shape":
			if(element.isGroup) {
				for(var m = 0; m < element.members.length; m++) {
					var member = element.members[m];
					out = out.concat(generateElementConstructor(fileName, member));
				}
			}
			for(var c = 0; c < element.contours.length; c++) {
				var contour = element.contours[c];						
				if(contour.fill.style == "bitmap") {
					out = out.concat(generateItem(fileName, libItems[document.library.findItemIndex(contour.fill.bitmapPath)]));
				}
			}
			break;
		case "instance":
			out = out.concat(generateItem(fileName, element.libraryItem));
			break;
	}
	return out;
}

var generatePolyPoint = function(shape, he, first) {
	var out = "",
		e = he.getEdge(),
		vertice = he.getVertex();
	
	out = first ? out.concat("{") : out.concat(",{");
	out = out.concat("x:").concat(vertice.x).concat(", y:").concat(vertice.y);
	if(!first && !e.isLine) {
		var cubicPoints = shape.getCubicSegmentPoints(e.cubicSegmentIndex);
		out = out.concat(",bc: [")
			.concat(cubicPoints[1].x).concat(",")
			.concat(cubicPoints[1].y).concat(",")
			.concat(cubicPoints[2].x).concat(",")
			.concat(cubicPoints[2].y)
			.concat("]");
	}
	out = out.concat("}");
	return out;
}

var generateShape = function(shape, instanceName) {
	var out = "";
	var instanceShapeBd = instanceName+"BD";
	
	out = out.concat("    var ").concat(instanceShapeBd).concat(" = game.cache.getBitmapData('").concat(instanceShapeBd).concat("');\n")
		.concat("    if(!").concat(instanceShapeBd).concat(") {\n")
		.concat("        ").concat(instanceShapeBd).concat(" = game.make.bitmapData(256, 256, '").concat(instanceShapeBd).concat("', true);\n")
		.concat("        var ctx = ").concat(instanceShapeBd).concat(".ctx;\n");

	for(var c = 0; c < shape.contours.length; c++) {
		var contour = shape.contours[c];
		var he = contour.getHalfEdge();
		var color = contour.fill.color || he.getEdge().stroke.color || "#000";

		//Property; a string that specifies the fill style. Acceptable values are "bitmap", "solid", "linearGradient", "radialGradient", and "noFill".
        //If this value is "linearGradient" or "radialGradient", the fill.colorArray and fill.posArray properties are also available. 
		//If this value is "bitmap", the fill.bitmapIsClipped and fill.bitmapPath properties are also available.		
		switch(contour.fill.style) {
			case "bitmap":
				//TODO
				//var bitmapItem = libItems[document.library.findItemIndex(contour.fill.bitmapPath)];
				//var bitmapName = item.name.substr(bitmapItem.name.lastIndexOf("/")+1, bitmapItem.name.length);
				//out = out.concat("        game.make.bitmapData(256, 256);\n");
				break;
			case "noFill":
				out = out.concat("        ctx.strokeStyle = '").concat(color).concat("';\n");
				break;
			case "solid":
				out = out.concat("        ctx.fillStyle = '").concat(color).concat("';\n");
				break;
			case "linearGradient":
				var matrix = contour.fill.matrix;
				var gradientInstance = "gradient" + (c+1);
				var gradPoints = null;
			
				if(contour.orientation == -1) {
					gradPoints = [
						matrix.a*1638.4+matrix.b*819.2, //x0
						matrix.c*1638.4+matrix.d*819.2, //y0
						matrix.b*819.2, //x1
						matrix.d*819.2  //y1
					];
				}
				else {
					gradPoints = [
						matrix.b*819.2, //x0
						matrix.d*819.2,  //y0
						matrix.a*1638.4+matrix.b*819.2, //x1
						matrix.c*1638.4+matrix.d*819.2 //y1
					];
				}

				out = out.concat("        var ").concat(gradientInstance).concat(" = ctx.createLinearGradient(").concat(gradPoints.join()).concat(");\n");
				
				for(var g = 0; g < contour.fill.colorArray.length; g++) {
					out = out.concat("        ").concat(gradientInstance).concat(".addColorStop(").concat(contour.fill.posArray[g]/255).concat(", '").concat(contour.fill.colorArray[g]).concat("');\n");
				}
				out = out.concat("        ctx.fillStyle = ").concat(gradientInstance).concat(";\n");
				break;
			case "radialGradient":
				//check http://rectangleworld.com/blog/archives/169
				/*var matrix = contour.fill.matrix;
				out = out.concat(matrix.a).concat(",")
						 .concat(matrix.b).concat(",")
						 .concat(matrix.c).concat(",")
						 .concat(matrix.d).concat(",")
						 .concat(matrix.tx).concat(",")
						 .concat(matrix.ty).concat("\n");*/
				break;
		}
		
		out = out.concat("        drawPolygon(ctx, [");
		
		var iStart = he.id; 
		var id = 0;
		while (id != iStart) 
		{ 
			out = out.concat(generatePolyPoint(shape, he, id == 0));
			he = he.getNext();
			id = he.id;
		}
		out = out.concat(generatePolyPoint(shape, he, false));
		out = out.concat("]);\n");

		if(contour.interior) {
			out = out.concat("        ctx.fill();\n");
		}
		else {
			out = out.concat("        ctx.stroke();\n");
		}
	}
	
	out = out.concat("    }\n")
		.concat("    var ").concat(instanceName).concat(" = game.make.sprite(0, 0, ").concat(instanceShapeBd).concat(");\n");

	return out;
}

var generateText = function(text, instanceName) {
	var out = "";
	var fontWeight = "";
	
	if(text.getTextAttr("bold"))
		fontWeight = "bold";
	else if(text.getTextAttr("italic"))
		fontWeight = "italic";

	out = out.concat("    var ")
		.concat(instanceName)
		.concat(" = game.make.text(")
		.concat(text.x)
		.concat(",")
		.concat(text.y)
		.concat(",'")
		.concat(text.getTextString())
		.concat("',")
		.concat("{")
		.concat("font:\"").concat(fontWeight + " " + text.getTextAttr("size") + "pt '" + text.getTextAttr("face"))
		.concat("'\",")
		.concat("fill:'").concat(text.getTextAttr("fillColor"))
		.concat("'\,")
		.concat("strokeThickness:2")
	.concat("});\n");
	
	return out;
}

var generateInstance = function(instance, instanceName, symbolName) {
	var out = "";
	
	out = out.concat("    var ")
				.concat(instanceName)
				.concat(" = lib.").concat(symbolName).concat("(game,").concat(instance.x).concat(",").concat(instance.y).concat(");\n");
			
	return out;
}

var generateTransformations = function(element, instanceName) {
	var out = "";
	if(element.scaleX != 1 || element.scaleY != 1) {
		out = out.concat("    ").concat(instanceName)
			.concat(".scale.set(").concat(element.scaleX).concat(",").concat(element.scaleY).concat(");\n");
	}
	
	if(element.rotation) {
		out = out.concat("    ").concat(instanceName)
			.concat(".angle = ").concat(element.rotation).concat(";\n");
	}
	return out;
}

var generateElement = function(element, groupInstances, symbolName) {
	var out = "";
	switch(element.elementType) {
		case "shape":
			if(element.contours.length > 0) {
				var instanceName = element.name || (symbolName+"_shape"+(groupInstances.length+1));
				out = out.concat(generateShape(element, instanceName))
					.concat(generateTransformations(element, instanceName));
				
				groupInstances.push(instanceName);
			}

			if(element.isGroup && element.members.length > 0) {
				for(var m = 0; m < element.members.length; m++) {
					var member = element.members[m];
					out = out.concat(generateElement(member, groupInstances, symbolName));
				}
			}
			break;
		case "text":
			var instanceName = element.name || (symbolName+"text"+(groupInstances.length+1));
			out = out.concat(generateText(element, instanceName))
				.concat(generateTransformations(element, instanceName));

			groupInstances.push(instanceName);
			break;
		case "instance":
			var symbolName = element.libraryItem.name.substr(element.libraryItem.name.lastIndexOf("/")+1, element.libraryItem.name.length).replace(/\.|\-/g, "");
			var instanceName = element.name || ("instance"+(groupInstances.length+1));
			out = out.concat(generateInstance(element, instanceName, symbolName))
				.concat(generateTransformations(element, instanceName));

			groupInstances.push(instanceName);
			break;
	}
	
	return out;
}

var generateSymbol = function(fileName, symbol) {	
	var timeline = symbol.timeline;	
	var out = "";	
	
	// generate referenced symbol definitions first
	for(var l = 0; l < timeline.layers.length; l++) {
		var layer = timeline.layers[l];
		for(var f = 0; f < layer.frames.length; f++) {
			var frame = layer.frames[f];
			for(var e = 0; e < frame.elements.length; e++) {
				var element = frame.elements[e];
				out = out.concat(generateElementConstructor(fileName, element));
			}
		}
	}
	
	// generate symbol
	var symbolName = symbol.name.substr(symbol.name.lastIndexOf("/")+1, symbol.name.length);
	var groupInstances = [];

	out = out.concat("lib.").concat(symbolName.replace(/\.|\-/g, "")).concat(" = function(game, x, y){\n")
		.concat("    var group = game.make.group();\n")
		.concat("    group.x = x;\n")
		.concat("    group.y = y;\n");
	
	for(var l = 0; l < timeline.layers.length; l++) {
		var layer = timeline.layers[l];
		for(var f = 0; f < layer.frames.length; f++) {
			var frame = layer.frames[f];
			//out = out.concat("//layer.animationtype: ").concat(layer.animationType).concat("\n");
			for(var e = 0; e < frame.elements.length; e++) {
				var element = frame.elements[e];
				//out = out.concat("//element.name: ").concat(element.name).concat("\n");
				out = out.concat(generateElement(element, groupInstances, symbolName));
				previousElement = element;
			}
		}
	}

	if(groupInstances.length > 0) {
		out = out.concat("    group.addMultiple([").concat(groupInstances.join()).concat("]);\n");
	}
	
	out = out.concat("    return group;\n")
	.concat("}\n\n");
	
	return out;
}

var generateItem = function(fileName, item) {
	if(exportedItems.indexOf(item.name) != -1)
		return "";

	switch(item.itemType) {		
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

var generateSymbols = function(fileName) {
	var out = "";
	exportedItems.length = 0;
	for (var i = 0; i < libItems.length; i++)
	{
		var item = libItems[i];
		
		// ignore items without linkage unless is referenced as instance in other item
		if(!item.linkageClassName)
			continue;
		
		out = out.concat(generateItem(fileName, item));		
	}
	return out;
};

var generateAssetFile = function(fileName) {
	var out = "// Generated by PFA-Exporter v0.3.6 at " + new Date().toUTCString() + "\n\n";
	
	out = out.concat("(function (lib) {	\n\n")
		.concat("var drawPolygon = function(ctx, poly) {\n")
		.concat("   if(poly.length < 1) return;\n")
		.concat("   ctx.beginPath();\n")
		.concat("   ctx.moveTo(poly[0].x, poly[0].y);\n")
		.concat("   for( var i=1 ; i < poly.length ; i++ ) {\n")
		.concat("      var p = poly[i];\n")
		.concat("      if(!p.bc)\n")
		.concat("          ctx.lineTo(p.x , p.y);\n")
		.concat("      else\n")
		.concat("          ctx.bezierCurveTo(p.bc[0],p.bc[1],p.bc[2],p.bc[3], p.x, p.y);\n")
		.concat("   }\n")
		.concat("}\n")
		.concat("// library properties:\n")
		.concat("lib.properties = {\n")
		.concat("	width:").concat(document.width).concat(",\n")
		.concat("	height:").concat(document.height).concat(",\n")
		.concat("	fps:").concat(document.frameRate).concat(",\n")
		.concat("	color:'").concat(document.backgroundColor).concat("',\n")
		.concat("	atlas: {\n")
		.concat("		name:'").concat(fileName).concat("',\n")
		.concat("		image:'").concat(fileName).concat(".png',\n")
		.concat("		metadata:'").concat(fileName).concat(".json',\n")
		.concat("	}\n")
		.concat("};\n\n")
		.concat("// symbols:\n")
		.concat(generateSymbols(fileName))
	.concat("})(lib = lib||{});\n")
	.concat("var lib;");

	return out;
}

/* Main */

var main = function() {
	var fileURL =  fl.browseForFileURL("save", "Select a JS", "Phaser Asset Document (*.js)", "js");

	if(!fileURL)
		return;

	for (var i = 0; i < libItems.length; i++)
	{
		var item = libItems[i];
		// ignore items without linkage unless is referenced as instance in other item
		if(!item.linkageClassName)
			continue;
		
		addSpriteSheetItem(item);	
	}

	var fileNoExtURL = fileURL.substr(0, fileURL.length - 3);
	var fileName = fileNoExtURL.substr(fileNoExtURL.lastIndexOf("/")+1, fileNoExtURL.length);
	
	// save phaser flash asset file
	fl.outputPanel.clear();
	fl.trace(generateAssetFile(fileName));
	fl.outputPanel.save(fileURL);

	// save atlas and metadata
	sse.autoSize = true;
	sse.allowRotate = true;
	sse.layoutFormat = "JSON-Array";
	sse.exportSpriteSheet(fileNoExtURL, {format:"png", bitDepth:32, backgroundColor:"#00000000"});

	fl.trace("exported assets successfully.");
}

main();
