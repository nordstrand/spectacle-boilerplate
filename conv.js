const fs = require('fs'),
      request = require('request'),
      cheerio = require('cheerio')
      Datauri = require('datauri'),
      arr = require('async-regex-replace');


const $ = cheerio.load(fs.readFileSync('index.html', 'utf8'));

asyncFlow(function* (cb) {
    for (let $scriptTag of iterateOverEls($('script'))) {
        const src = $scriptTag.attr('src');

        console.error("Inlining <script> src", src);

        if (src.match(/^http/)) {
           const [_, body] = yield request(src, cb),
               datauri = new Datauri();

           datauri.format('.js', body);
           $scriptTag.attr('src', datauri.content);
        } else {
            $scriptTag.attr('src', Datauri.sync(src));
        }
    }

    for (let $linkTag of iterateOverEls($('link'))) {
        const href = $linkTag.attr('href');

        console.error("Inlining <link> href", href);
			const body = href.match(/^http/) ? (yield request(href, cb))[1] : 
				fs.readFileSync(href, 'utf8'),
			inlinedBody = yield inlineCssUrls(body, cb),
			datauri = new Datauri();

		datauri.format('.css', inlinedBody);
		$linkTag.attr('href', datauri.content);
    }
    const output = $.html();
    console.log(output);
    console.error(`Outputted ${output.length}b of data.`);
});


function* iterateOverEls(a) {
	for(let i = 0; i < a.length; i++) {
		yield $(a[i]);
	}
}

function inlineCssUrls(css, finalResultCb) {
    arr.replace(/url\((.*?)\)/g, css, function(match, captured, cb) {
        console.error(" Inlining webfont URL ", captured);
        request({url: captured, encoding: null}, (err, resp, body) => {
            if (err) {
                return cb(err);
            };

            const datauri = new Datauri();
            datauri.format('.woff2', body);
            cb(null, 'url(' + datauri.content + ')');
        });
    },
    function(err, finalResult) {
        err && console.error("Err", err)
        setTimeout(finalResultCb.bind(this, err, finalResult), 0);
    });
}

function asyncFlow(generatorFunction) {
    function callback(err, ...results) {
        if(err) {
            return generator.throw(err);
        }
        generator.next(results.length > 1 ? results : results[0]);
    };
    var generator = generatorFunction(callback);
    generator.next();
}
