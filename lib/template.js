'use strict';

const pathFn = require('path');
const fs = require('fs');
const { format, parse } = require('url');
let sitemapTmpl;

module.exports = function(config) {
  if (sitemapTmpl) return sitemapTmpl;

  const nunjucks = require('nunjucks');
  const env = new nunjucks.Environment(null, {
    autoescape: false,
    watch: false
  });

  env.addFilter('uriencode', str => {
    if (str) {
      return format({
        protocol: parse(str).protocol,
        hostname: parse(str).hostname,
        pathname: encodeURI(parse(str).pathname)
      });
    }
  });

  const sitemapSrc = config.sitemap.template || pathFn.join(__dirname, '../sitemap.xml');
  sitemapTmpl = nunjucks.compile(fs.readFileSync(sitemapSrc, 'utf8'), env);

  return sitemapTmpl;
};
