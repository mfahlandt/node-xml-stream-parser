"use strict";

import { expect } from "chai";
import Parser from "./index";

import fs from "fs";

describe("node-xml-stream", function() {
  describe("Emit instruction", function() {
    it("#on(instruction)", function(done) {
      let p = new Parser();

      p.on("instruction", function(name, attrs) {
        expect(name).to.eql("xml");
        expect(attrs)
          .to.be.a("object")
          .with.property("version", "2.0");
        expect(attrs).to.have.property("encoding", "utf-8");
        done();
      });

      p.write('<root><?xml version="2.0" encoding="utf-8"?></root>');
    });
  });
  describe("Emit Tag after that have namespace ", function() {
    it("#on(instruction)", function(done) {
      let p = new Parser();

      p.on("opentag", function(name, attrs) {
        expect(name).to.eql("imo:openimmo");
        expect(attrs)
          .to.be.a("object")
          .with.property("xmlns:imo", "http://www.openimmo.de");
        done();
      });

      p.write(
        '<?xml version="1.0" encoding="UTF-8"?><imo:openimmo xmlns:imo="http://www.openimmo.de" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"  xsi:schemaLocation="http://www.openimmo.de openimmo.xsd"></imo:openimmo>'
      );
    });
  });

  describe("Emit opentag", function() {
    it("#on(opentag)", function(done) {
      let p = new Parser();

      p.on("opentag", function(name, attrs) {
        expect(name).to.eql("root");
        expect(attrs)
          .to.be.a("object")
          .with.property("name", "steeljuice");
        done();
      });

      p.write('<root name="steeljuice"><sub>TEXT</sub></root>');
    });
  });

  describe("Emit closetag", function() {
    it("#on(closetag)", function(done) {
      let p = new Parser();

      p.on("closetag", function(name) {
        expect(name).to.eql("root");
        done();
      });

      p.write('<root name="steeljuice">TEXT</root>');
    });

    it("#on(closetag) self closing.", function(done) {
      let p = new Parser();
      p.on("closetag", function(name, attrs) {
        expect(name).to.eql("self");
        expect(attrs)
          .to.be.a("object")
          .with.property("name", "steeljuice");
      });

      p.write('<self name="steeljuice" />');
      done();
    });
    it("#on(closetag) empty self closing.", function(done) {
      let p = new Parser();
      p.on("closetag", function(name, attrs) {
        console.log(name);
        expect(name).to.eql("self");
        expect(attrs)
          .to.be.a("object")
          .with.property("___selfClosing___", true);
      });

      p.write("<self/>");
      done();
    });
    it("#on(closetag) empty self closing without space.", function(done) {
      let p = new Parser();
      p.on("closetag", function(name, attrs) {
        console.log(name);
        expect(name).to.eql("self");
        expect(attrs)
          .to.be.a("object")
          .with.property("___selfClosing___", true);
      });

      p.write("<self />");
      done();
    });
  });

  describe("Emit text", function() {
    it("#on(text)", function(done) {
      let p = new Parser();
      p.on("text", function(text) {
        expect(text).to.eql("SteelJuice");
        done();
      });
      p.write('<self name="steeljuice"/><root>SteelJuice</root>');
    });
  });

  describe("Emit CDATA", function() {
    it("#on(cdata)", function(done) {
      let p = new Parser();

      p.on("cdata", function(cdata) {
        expect(cdata).to.eql("<p>cdata-text</br></p>");
        done();
      });

      p.write("<root><![CDATA[<p>cdata-text</br></p>]]></root>");
    });
  });

  describe("Emit CDATA with square-bracket text", function() {
    it("#on(cdata)", function(done) {
      let p = new Parser();

      p.on("cdata", function(cdata) {
        expect(cdata).to.eql("<p>cdata-text with some square-bracket-wrapped text [[12345]]</br></p>");
        done();
      });

      p.write("<root><![CDATA[<p>cdata-text with some square-bracket-wrapped text [[12345]]</br></p>]]></root>");
    });
  });

  describe("Ignore comments", function() {
    it("#on(text) with comments", function(done) {
      let p = new Parser();
      p.on("text", function(text) {
        expect(text).to.eql("TEXT");
        done();
      });

      p.write(
        "<root><!--Comment is written here! -->TEXT<!-- another comment! --></root>"
      );
    });
  });

  describe("Stream", function() {
    it("#pipe() a stream.", function(done) {
      let p = new Parser();
      let stream = fs.createReadStream("./test/intertwingly.atom");
      stream.pipe(p);

      // Count the number of entry tags found (start/closing) and compare them (they should be the same) when the stream is completed.
      let entryclose = 0;
      let entrystart = 0;
      p.on("closetag", name => {
        if (name === "entry") entryclose++;
      });
      p.on("opentag", name => {
        if (name === "entry") entrystart++;
      });
      p.on("finish", () => {
        expect(entryclose).to.eql(entrystart);
        done();
      });
    });
  });

  describe("Attributes", function() {
    it("parses empty, namespaced and multiline attributes", function(done) {
      let p = new Parser();
      p.on("opentag", function(name, attrs) {
        expect(name).to.eql("root");
        expect(attrs).to.eql({ a: "1", b: "", "c:d": "e f" });
        done();
      });
      p.write('<root a="1" b=""\n c:d="e f">');
    });
  });

  describe("Denial of Service (GHSA-5j83-mpvp-f3gm)", function() {
    this.timeout(5000);

    it("does not backtrack on unterminated attribute values (ReDoS)", function(done) {
      let p = new Parser();
      const start = Date.now();
      p.on("finish", () => {
        expect(Date.now() - start).to.be.below(1000);
        done();
      });
      p.write('<a b="' + "C".repeat(200000) + ">");
      p.end();
    });

    it("handles long text without markup in linear time", function(done) {
      let p = new Parser();
      const start = Date.now();
      p.on("finish", () => {
        expect(Date.now() - start).to.be.below(1000);
        done();
      });
      p.write("A".repeat(500000));
      p.end();
    });

    it("handles long text split into many chunks in linear time", function(done) {
      let p = new Parser();
      const start = Date.now();
      p.on("finish", () => {
        expect(Date.now() - start).to.be.below(1000);
        done();
      });
      for (let i = 0; i < 500; i++) p.write("A".repeat(1000));
      p.end();
    });

    it("emits an error when the buffer limit is exceeded", function(done) {
      let p = new Parser();
      p.on("error", err => {
        expect(err.message).to.match(/Max buffer length/);
        done();
      });
      p.write("A".repeat(1024 * 1024 + 1));
    });
  });
});
