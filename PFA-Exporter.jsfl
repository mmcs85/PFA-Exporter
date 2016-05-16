/**
* @desc         Phaser Flash Asset Exporter
* @version      0.3 - May 15th 2016
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

var generateBitmapDefinition = function(fileName, item) {
	var out = "";
	var symbolName = item.name.substr(item.name.lastIndexOf("/")+1, item.name.length);		
	out = out.concat("lib.").concat(symbolName.replace("\.", "")).concat(" = function(game, x, y){\n")
		.concat("    return game.make.sprite(x, y, '").concat(fileName).concat("', '").concat(symbolName).concat("');\n")
		.concat("}\n\n");
	return out;
}

var generateElementDefinition = function(fileName, element) {	
	var out = "";
	switch(element.elementType) {
		case "shape":
			if(element.isGroup) {
				for(var m = 0; m < element.members.length; m++) {
					var member = element.members[m];
					out = out.concat(generateElementDefinition(fileName, member));
				}
			}
			break;
		case "instance":
			out = out.concat(generateItem(fileName, element.libraryItem));
			break;
	}
	return out;
}

var generateShape = function(shape, instanceName) {
	var out = "";
	
	out = out.concat("    var ")
				.concat(instanceName)
				.concat(" = game.make.graphics(").concat(shape.x).concat(",").concat(shape.y).concat(")\n");

	for(var c = 0; c < shape.contours.length; c++) {
		var contour = shape.contours[c];
		
		if(contour.interior) {
			out = out.concat("        .beginFill('").concat(contour.fill.color).concat("')\n");
		}
		
		var he = contour.getHalfEdge(); 
 
		var iStart = he.id; 
		var id = 0;
		var points = [];
		while (id != iStart) 
		{ 
			var vertice = he.getVertex();  
			points.push(vertice.x);
			points.push(vertice.y);
			he = he.getNext(); 
			id = he.id; 
		}
		
		out = out.concat("        .drawPolygon([").concat(points.join()).concat("])");
		
		if(contour.interior) {
			out = out.concat("\n        .endFill()");
		}
		
		if(c == shape.contours.length-1) {
			out = out.concat(";\n");
		}
		else {
			out = out.concat("\n");
		}
	}
	return out;
}

var generateInstance = function(instance, instanceName, symbolName) {
	var out = "";
	
	out = out.concat("    var ")
				.concat(instanceName)
				.concat(" = lib.").concat(symbolName).concat("(game,").concat(instance.x).concat(",").concat(instance.y).concat(");\n");
			
	return out;
}

var generateElement = function(element, groupInstances) {
	var out = "";

	switch(element.elementType) {
		case "shape":			
			if(element.isGroup && element.members.length > 0) {
				for(var m = 0; m < element.members.length; m++) {
					var member = element.members[m];
					out = out.concat(generateElement(member, groupInstances));
				}
			}
			else {				
				var instanceName = element.name || ("shape"+(groupInstances.length+1));
				out = out.concat(generateShape(element, instanceName));
				groupInstances.push(instanceName);
			}
			break;
		case "instance":
			var symbolName = element.libraryItem.name.substr(element.libraryItem.name.lastIndexOf("/")+1, element.libraryItem.name.length).replace("\.", "");
			var instanceName = element.name || ("instance"+(groupInstances.length+1));
			out = out.concat(generateInstance(element, instanceName, symbolName));
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
				out = out.concat(generateElementDefinition(fileName, element));
			}
		}
	}
	
	// generate symbol
	var symbolName = symbol.name.substr(symbol.name.lastIndexOf("/")+1, symbol.name.length);
	var groupInstances = [];

	out = out.concat("lib.").concat(symbolName.replace("\.", "")).concat(" = function(game, x, y){\n")
		.concat("    var group = game.make.group();\n")
		.concat("    group.x = x;\n")
		.concat("    group.y = y;\n");
	
	for(var l = 0; l < timeline.layers.length; l++) {
		var layer = timeline.layers[l];
		for(var f = 0; f < layer.frames.length && f < 1; f++) {
			var frame = layer.frames[f];
			for(var e = 0; e < frame.elements.length; e++) {
				var element = frame.elements[e];								
				out = out.concat(generateElement(element, groupInstances));
			}
		}
	}

	if(groupInstances.length > 0) {
		out = out.concat("    group.addMutiple([").concat(groupInstances.join()).concat("]);\n");
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
			return generateBitmapDefinition(fileName, item);
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
	var out = "// Generated by PFA-Exporter v0.3 at " + new Date().toUTCString() + "\n\n";
	
	out = out.concat("(function (lib) {	\n\n")
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
	sse.layoutFormat = "JSON";
	sse.exportSpriteSheet(fileNoExtURL, {format:"png", bitDepth:32, backgroundColor:"#00000000"});

	fl.trace("exported assets successfully.");
}

main();