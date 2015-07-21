var express = require('express');
var http = require("http");
var request = require("request");
var parseXml = require('xml2js').parseString;
var bodyParser = require('body-parser');
var hbs = require("handlebars");

var app = express();

var mongo = require('mongodb');
var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/mydata')

var PROD = true;
var PORT_NUMBER = 3000;

var Schema = mongoose.Schema;

var captionSchema = new Schema({
    txt: {type: String, required: true},
    sta: {type: Number, required: true},
    dur: {type: Number, default: -1},
    beginPar: {type: Boolean, default: false},
    endPar: {type: Boolean, default: false}
});

var TRANSCRIPT_SOURCES = {
    values: ['yt_auto', 'my_auto', 'yt_manual'],
    message: 'Enum validator failed for path `{PATH}` with value `{VALUE`'
};

var transcriptSchema = new Schema({
    edited: {type: Boolean, required: true},
    source: {type: String, required: true, enum: TRANSCRIPT_SOURCES},
    captions: {type: [captionSchema], required: true},
});

var videoSchema = new Schema({
    ytId: {type: String, required: true},
    transcripts: {type: [transcriptSchema], default: []}
});

var Caption = mongoose.model('caption', captionSchema);
var Transcript = mongoose.model('transcript', transcriptSchema);
var Video = mongoose.model('video', videoSchema);

function toIdString(str) {
    while (str.length < 24) {
        str += '!';
    }
    return str;
}

app.set('views', __dirname + '/views');
app.set('view engine', 'hbs');

var api = express();

api.use(bodyParser.json()); // support json encoded bodies
api.use(bodyParser.urlencoded({ 
    extended: true, 
    limit: '3mb',
    parameterLimit: 10000
})); // support encoded bodies

api.get('/auto_captions/*', function(req, res) {
    var ytId = req._parsedUrl.pathname.split('auto_captions/')[1].split('/')[0];
	var url = "http://www.youtube.com"
	var ytUrl = "http://www.youtube.com/watch?v=" + ytId;
    var options = {
        'uri': ytUrl,
        'timeout': 1000,
        'followRedirect': true,
        'maxRedirects': 5
    };


	request(options, function(error, response, body) {
		if (!error && response.statusCode == 200) {
			var re = /;ytplayer.config = ({.*?});/;
			var mobj = body.match(re);
			if (!mobj) {
				console.log("Couldn't find automatic captions");
				return;
			}
			var player_config = JSON.parse(mobj[1]);
            var args = player_config['args'],
            	caption_url = args['ttsurl'],
            	timestamp = args['timestamp'];

            // We get the available subtitles
            var list_params = urlEncode({
                'type': 'list',
                'tlangs': 1,
                'asrs': 1,
            })
            var list_url = caption_url + '&' + list_params;
            // console.log(list_url);

            var params = urlEncode({
            	'lang': 'en',
            	'tlang': 'en',
            	'fmt': 'srv1',
            	'ts': timestamp,
            	'kind': "asr" // this might be wrong
            });

            var options2 = {
                'uri': caption_url + '&' + params,
                'timeout': 1000
            };
            if (!caption_url) {
                console.log("Captions unavailable");
                res.jsonp({timeout: true});
                return;
            }

            request(options2, function(error, response, body) {
            	// console.log(caption_url + '&' + params);
            	if (!error && response.statusCode == 200) {
		            var transcript = getXml(body);
		            res.jsonp(transcript);
            	}
            }).on('error', function(err) {
                if (err.code === 'ETIMEDOUT') {
                    res.jsonp({timeout: true});
                    // console.log(options2);
                }
            });
		}
	}).on('error', function(err) {
      if (err.code === 'ETIMEDOUT') {
        res.jsonp({timeout: true});
      }
    });
});


api.post('/postTranscript*', function(req, res) {
    var madePost = false;
    var transcript = req.body.transcript || {};
    var ytId = req.body.ytId;

    console.log(ytId);

    if (transcript) {
        madePost = true;
        Video.find({ytId: ytId}, function (err, docs) {
            var cur = new Transcript({
                source: req.body.source,
                edited: req.body.edited,
                captions: transcript
            });

            if (docs.length) {
                console.log("update video");
                var newEntry = Video.findOneAndUpdate(
                    {ytId: ytId},
                    {$push: {transcripts: cur}},
                    {upsert: true},
                    function(err, docs) {
                        if (err) {
                            console.log(err);
                        }
                    }
                );    
            }
            else {
                console.log("new video");
                Video.create({
                    ytId: ytId,
                    transcripts: [cur]
                }, function (err, video) {
                    if (err) console.log("err");
                });                
            }          
        });
    }
    res.jsonp({"madePost": madePost});
});


app.use('/static', express.static('views/static'));

app.use('/about*', express.static('views/static/about.html'));
app.use('/about/*', express.static('views/static/about.html'));

var homepage = function(req, res) {
	var query = req.query || {};
	var ytId = query.v || 'Ei8CFin00PY';

    Video.findOne({'ytId': ytId}, {}, function(err, video) {
        // console.log(video);
        var captions = null;
        var transcriptType = "";
        if (video) {
            var avail = video.transcripts;
            var curTranscript = avail[avail.length-1];
            captions = curTranscript.captions;
            for (var i = 0; i < captions.length - 1; i++) {
                captions[i+1].beginPar = captions[i+1].beginPar || captions[i].endPar;
                captions[i].endPar = captions[i+1].beginPar;
            }
            if (curTranscript.edited) {
                if (curTranscript.source == "yt_manual") {
                    transcriptType = "This is an edited manual transcript.";
                } else {
                    transcriptType = "This is an edited auto-generated transcript.";
                }
            } else {
                if (curTranscript.source != "yt_manual") {
                    transcriptType = "This is an unedited auto-generated transcript.";
                }
            }
        }
        // console.log(transcriptType);
        var transcriptSource = video ? curTranscript.source : null;
        var transcriptEdited = video ? curTranscript.edited : null;

        var transcriptLoaded = !!captions;
        res.render('index', {
            'ytId': ytId, 
            'transcriptLoaded': transcriptLoaded,
            'transcript': captions,
            'transcriptSource': transcriptSource,
            'transcriptEdited': transcriptEdited,
            'transcriptType': transcriptType
        });
    });
};

app.get('/', homepage);
app.get('/watch', homepage);

app.use('/api', api);

var server = app.listen(PORT_NUMBER, function() {

	var host = server.address().address;
	var port = server.address().port;

	console.log('Example app listening at http://%s:%s', host, port);
});

function urlEncode(obj) {
  var str = [];
  for(var p in obj)
    if (obj.hasOwnProperty(p)) {
      str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
    }
  return str.join("&");
}

function getPageContents(url) {
	// same weird scoping deal
	var contents;
	console.log("getPageContentsBeg for ", url);
	request.get(url, function(error, res, body) {
		if (error) {
			console.log("Error");
			contents = null;
			// return null;
		}
		else {
			contents = body;
		}
	});
	return contents;
}

function getXml(str) {
	// I hope that the scoping on this doesn't behave strangely
	var xml;
	parseXml(str, function(err, result) {
		xml = result;
	});
	return xml;
}

var url = "https://www.youtube.com/api/timedtext?v=gF51doydNxs&asr_langs=it%2Cru%2Ces%2Cfr%2Cko%2Cde%2Cpt%2Cja%2Cnl%2Cen&key=yttt1&expire=1435971001&signature=BF55883944DE63B22E956A1E5A7D02CF0B145507.6E86BCEB9EF6A27E5B85D158285A95E3050B2771&hl=en_US&caps=asr&sparams=asr_langs%2Ccaps%2Cv%2Cexpire&type=list&tlangs=1&asrs=1";
// console.log(getPageContents(url));
// console.log(getPageContents("http://www.youtube.com"));