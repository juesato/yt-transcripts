var express = require('express');
var http = require("http");
var app = express();
var request = require("request");
var parseXml = require('xml2js').parseString;
var hbs = require("handlebars");

app.set('views', __dirname + '/views');
app.set('view engine', 'hbs');

var api = express();
api.get('/auto_captions/*', function(req, res) {
	var url = "http://www.youtube.com"
	var ytId = req._parsedUrl.pathname.split('auto_captions/')[1].split('/')[0];
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
                console.log("innercallback");
            	if (!error && response.statusCode == 200) {
		            var transcript = getXml(body);
		            res.jsonp(transcript);
            	}
            }).on('error', function(err) {
                console.log("ERROR");
                if (err.code === 'ETIMEDOUT') {
                    res.jsonp({timeout: true});
                    console.log("TimeoutInner!");
                }
            });
		}
	}).on('error', function(err) {
      if (err.code === 'ETIMEDOUT') {
        res.jsonp({timeout: true});
        console.log("Timeout!");
      }
    });
});

app.use('/static', express.static('views/static'));

var homepage = function(req, res) {
	var query = req.query || {};
	var ytId = query.v || 'Ei8CFin00PY';
	res.render('index', {'ytId': ytId});
};

app.get('/', homepage);
app.get('/watch', homepage);

app.use('/api', api);

var server = app.listen(3000, function() {

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