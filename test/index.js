'use strict';

const should = require('chai').should(); // eslint-disable-line
const Hexo = require('hexo');
const nunjucks = require('nunjucks');
const env = new nunjucks.Environment();
const pathFn = require('path');
const fs = require('fs');
const { format, parse } = require('url');
const cheerio = require('cheerio');

env.addFilter('uriencode', str => {
  if (str) {
    return format({
      protocol: parse(str).protocol,
      hostname: parse(str).hostname,
      pathname: encodeURI(parse(str).pathname)
    });
  }
});

const sitemapTmplSrc = pathFn.join(__dirname, '../sitemap.xml');
const sitemapTmpl = nunjucks.compile(fs.readFileSync(sitemapTmplSrc, 'utf8'), env);

const urlConfig = {
  url: 'http://localhost/',
  root: '/'
};

describe('Sitemap generator', () => {
  const hexo = new Hexo(__dirname, {silent: true});
  hexo.config.sitemap = {
    path: 'sitemap.xml'
  };
  const Post = hexo.model('Post');
  const generator = require('../lib/generator').bind(hexo);

  require('../node_modules/hexo/lib/plugins/helper')(hexo);

  let posts = {};
  let locals = {};

  before(() => {
    return Post.insert([
      {source: 'foo', slug: 'foo', updated: 1e8},
      {source: 'bar', slug: 'bar', updated: 1e8 + 1},
      {source: 'baz', slug: 'baz', updated: 1e8 - 1}
    ]).then(data => {
      posts = Post.sort('-updated');
      locals = hexo.locals.toObject();
    });
  });

  it('default', () => {
    hexo.config = Object.assign(hexo.config, urlConfig);
    const result = generator(locals);
    result.path.should.eql('sitemap.xml');
    result.data.should.eql(sitemapTmpl.render({
      config: hexo.config,
      posts: posts.toArray()
    }));

    const $ = cheerio.load(result.data);

    $('url').each((index, element) => {
      $(element).children('loc').text().should.eql(posts.eq(index).permalink);
      $(element).children('lastmod').text().should.eql(posts.eq(index).updated.toISOString());
    });
  });

  describe('skip_render', () => {
    it('array', () => {
      hexo.config.skip_render = ['foo'];

      const result = generator(locals);
      result.data.should.not.contain('foo');
    });

    it('string', () => {
      hexo.config.skip_render = 'bar';

      const result = generator(locals);
      result.data.should.not.contain('bar');
    });

    it('off', () => {
      hexo.config.skip_render = null;

      const result = generator(locals);
      result.should.be.ok;
    });
  });

  it('IDN handling', () => {
    const checkURL = function(url, root) {
      hexo.config.url = url;
      hexo.config.root = root;

      const result = generator(locals);
      const $ = cheerio.load(result.data);

      const punyIDN = format({
        protocol: parse(url).protocol,
        hostname: parse(url).hostname,
        pathname: encodeURI(parse(url).pathname)
      });

      $('url').each((index, element) => {
        console.log($(element).children('loc').text())
        $(element).children('loc').text().startsWith(punyIDN).should.be.true;
      });
    };

    checkURL('http://fôo.com/', '/');

    checkURL('http://fôo.com/bár', '/bár/');
  });
});
