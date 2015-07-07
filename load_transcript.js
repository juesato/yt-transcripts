function cleanLine(line) {
	var clean = line.trim();
	clean = clean.replace(/&amp;/g, "&");
	clean = clean.replace(/&lt;/g, "<");
	clean = clean.replace(/&gt;/g, ">");
	clean = clean.replace(/&quot;/g, '"');
	clean = clean.replace(/&#37;/g, "%");
	clean = clean.replace(/&#39;/g, "'");

	return clean;
}


function cleanTranscript(lines) {
	var punctuation = ['.', '?', '!'];
	var clean = [];
	var cur = {};
	var curSentenceLen = 0, curdur = 0;
	var PAR_THRESHOLD = 250; // TODO: this should vary with the speaker's speaking speed

	cur.txt = "";

	lines[0].beginPar = true;
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].txt;
		line = cleanLine(line);

		if (cur.txt == "") {
			cur.sta = lines[i].sta;
		}

		cur.txt += (line + " ");
		curSentenceLen++;
		curdur += lines[i].dur;

		cur.beginPar = lines[i].beginPar;
		cur.endPar = lines[i].endPar;
		
		if (i == lines.length - 1) { // push everything else
			console.log("END");
			clean.push(JSON.parse(JSON.stringify(cur)));
			cur.txt = "";
			curdur = 0;
		}
		else if (punctuation.indexOf(line.slice(-1)) != -1) {
			var cur.endPar = false;
			var curWordLen = cur.txt.split(" ").length;
			// if words_per_second^1.5 * curlen > threshold, start a new paragraph
			var score = 1 / Math.pow(curWordLen, .2) * Math.pow(curdur, 1.3) * Math.pow(curSentenceLen, 2);
			if (score > PAR_THRESHOLD) {
				cur.endPar = true;
				curSentenceLen = 0;
			}

			if (curWordLen < 4 && !cur.beginPar) { // join short lines with previous line 
				var tmp = clean[clean.length-1].txt.split(NEW_PAR_STR); // get section before new line
				if (tmp.length > 1) {
					clean[clean.length-1].txt = tmp[0] + cur.txt + NEW_PAR_STR;
				}
				else {
					clean[clean.length-1].txt = tmp + cur.txt;
				}				
			}
			else { // add on new line
				// console.log(cur);
				clean.push(JSON.parse(JSON.stringify(cur)));
			}
			cur.txt = ""; // Reset
			curdur = 0;
		}

	}

	return clean;
}

function getTranscriptXML(ytId) {
	var xhr = new XMLHttpRequest();
	var async = false;
	xhr.open("GET", "http://www.youtube.com/api/timedtext?lang=en&v=" + ytId, async);
	xhr.send();	// TODO: Make this async, and wrap everything else in xhr.onSuccess

	// console.log(xhr);

	// TODO: Catch errors if manual transcript is unavailable
	if (!xhr.responseXML) {
		// console.log("No manual transcript available");
		return -1;
	}
	return xhr.responseXML.firstChild;
}

function getManualTranscript(ytId) {
	var xhr = new XMLHttpRequest();
	var async = false;
	xhr.open("GET", "http://www.youtube.com/api/timedtext?lang=en&v=" + ytId, async);
	xhr.send();	
	xhr.onreadystatechange = function() {
    	if (xhr.readyState==4 && xhr.status==200) {
			var lines = [];
			var xml = xhr.responseXML.firstChild;
			var nodes = xml.getElementsByTagName("text");
				
			for (var i = 0; i < nodes.length; i++) {
				var dur = parseFloat(nodes[i].getAttribute("dur"));
				var start = nodes[i].getAttribute("start");
				var text = nodes[i].innerHTML;

				var cur = {};
				cur.dur = dur;
				cur.sta = start;
				cur.txt = text;
				lines.push(cur);
			}
			$(document).ready(function() {
				loadLinesIntoDOM(lines);		
			});
		}	
	}	
}

function loadTranscript() {
	console.log("loadTranscript");
	var xml = getTranscriptXML(curVideoId);

	var transcriptDiv = document.getElementById("transcript");
	transcriptDiv.innerHTML = "";

	var lines = [];

	if (xml == -1) { // No transcript available
		var iSpan = document.createElement("span");		
		// iSpan.innerHTML = "Sorry, no manual transcript is available";
		iSpan.innerHTML = "The follow transcript is automatically generated: \n\n"
		transcriptDiv.appendChild(iSpan);

		lines = getAutoTranscript(curVideoId);
		// return;
	}
	else {
		var nodes = xml.getElementsByTagName("text");
		
		for (var i = 0; i < nodes.length; i++) {
			var dur = parseFloat(nodes[i].getAttribute("dur"));
			var start = nodes[i].getAttribute("start");
			var text = nodes[i].innerHTML;

			var cur = {};
			cur.dur = dur;
			cur.sta = start;
			cur.txt = text;
			lines.push(cur);
		}			
	}

	console.log("lines");
	console.log(lines);

	var speakerNames = getSpeakerNames(lines); // call on uncleaned version
	// var new_par = "<br>&nbsp;&nbsp;&nbsp;&nbsp;";

	for (var i = 0; i < lines.length; i++) {
		var tmp = lines[i].txt.split(':')[0];
		if (speakerNames.indexOf(tmp) != -1) {
			lines[i].beginPar = true;
		}
	}


	var clean = cleanTranscript(lines);

	console.log("clean");
	console.log(clean);

	curCaptionTimes.length = 0;
	curCaptionDivs.length = 0;

	for (var i = 0; i < clean.length; i++) {
		var iSpan = document.createElement("span");
		iSpan.id = "caption" + i;
		iSpan.class = "caption";
		iSpan.onclick = (function(j) {
			return function() {
				setVideoTime(clean[j].sta);
				maintainPosition = true;
			};
		})(i);

		// var caption = clean[i].txt.split(NEW_PAR_STR);
		// iSpan.innerHTML = caption[0];
		iSpan.innerHTML = clean[i].txt;
		transcriptDiv.appendChild(iSpan);

		if (i < clean.length - 1 && (clean[i].endPar || clean[i+1].beginPar)) {
			var parBreak = document.createElement("span");
			parBreak.class = "parBreak";
			parBreak.id = "parBreak" + i;
			parBreak.innerHTML = NEW_PAR_STR;
			transcriptDiv.appendChild(parBreak);
		}

		curCaptionDivs.push(iSpan);
		curCaptionTimes.push(clean[i].sta);

	}
}

function loadLinesIntoDOM(lines) {
	var speakerNames = getSpeakerNames(lines); // call on uncleaned version
	// var new_par = "<br>&nbsp;&nbsp;&nbsp;&nbsp;";

	for (var i = 0; i < lines.length; i++) {
		var tmp = lines[i].txt.split(':')[0];
		if (speakerNames.indexOf(tmp) != -1) {
			lines[i].beginPar = true;
		}
	}


	var clean = cleanTranscript(lines);

	// console.log("clean");
	// console.log(clean);
	
	var transcriptDiv = document.getElementById("transcript");
	transcriptDiv.innerHTML = "";

	curCaptionTimes.length = 0;
	curCaptionDivs.length = 0;

	for (var i = 0; i < clean.length; i++) {
		var iSpan = document.createElement("span");
		iSpan.id = "caption" + i;
		iSpan.class = "caption";
		iSpan.onclick = (function(j) {
			return function() {
				setVideoTime(clean[j].sta);
				maintainPosition = true;
			};
		})(i);

		// var caption = clean[i].txt.split(NEW_PAR_STR);
		// iSpan.innerHTML = caption[0];
		iSpan.innerHTML = clean[i].txt;
		transcriptDiv.appendChild(iSpan);

		if (i < clean.length - 1 && (clean[i].endPar || clean[i+1].beginPar)) {
			var parBreak = document.createElement("span");
			parBreak.class = "parBreak";
			parBreak.id = "parBreak" + i;
			parBreak.innerHTML = NEW_PAR_STR;
			transcriptDiv.appendChild(parBreak);
		}

		curCaptionDivs.push(iSpan);
		curCaptionTimes.push(clean[i].sta);
	}
	return 1;
}
