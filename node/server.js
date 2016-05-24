// Initially copypasta'd from https://github.com/mhart/react-server-example
// https://github.com/mhart/react-server-example/blob/master/server.js

var http = require('http'),
    url = require('url'),
    fs = require('fs'),
    vm = require('vm'),
    express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    redis = require('redis'),
    React = require('react'),
    ReactDOMServer = require('react-dom/server'),
    SefariaReact = require('../static/js/s2');
    ReaderApp = React.createFactory(SefariaReact.ReaderApp);

var server = express();

server.use(bodyParser.urlencoded({ extended: false }));
server.use(bodyParser.json());

var renderReaderApp = function(props, data, timer) {
  // Returns HTML of ReaderApp component given `props` and `data`
  SefariaReact.setData(data);
  var panels = props.initialPanels || [];
  for (var i = 0; i < panels.length; i++) {
    var panel = panels[i];
    if ("text" in panel) {
      SefariaReact.saveTextData(panel.text, {context: 1, version: panel.version, language: panel.language});
    }
  }
  console.log("Time to set data: %dms", timer.elapsed());
  
  var html  = ReactDOMServer.renderToString(ReaderApp(props));
  console.log("Time to render: %dms", timer.elapsed());
  
  return html;
}

server.post('/ReaderApp', function(req, res) {
  var timer = {
    start: new Date(), 
    elapsed: function() { return (new Date() - this.start); }
  };
  var props = JSON.parse(req.body.propsJSON);
  console.log(props.initialRefs);
  console.log("Time to props: %dms", timer.elapsed());

  request("http://localhost:8000/data.js", function(error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log("Time to get data.js: %dms", timer.elapsed());
      eval(body);
      console.log("Time to eval data.js: %dms", timer.elapsed());
      var html = renderReaderApp(props, data, timer);
      res.end(html);
      console.log("Time to complete: %dms", timer.elapsed());  
    } else {
      res.end("There was an error accessing /data.js.");
    }
  });
});

server.listen(4040, function() {
  console.log('Listening on 4040...');
});