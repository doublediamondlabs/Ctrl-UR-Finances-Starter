import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import esbuild from '../app/Source/node_modules/esbuild/lib/main.js';
import {statementHTML} from '../app/Source/loan.js';
import {csv} from '../app/Source/businessReports.js';

const attack = '<img src=x onerror="alert(1)"> & "quoted"';
const loan = {borrower:attack,principal:1000,start:'2026-01',initialPayment:100,monthlyPayment:100,rateChange:'2026-01',dueDay:15,graceDays:4,receipts:[],remittances:[],openingForwarded:null,openingForwardedDate:''};
const w = new JSDOM(statementHTML(loan,'2026-03-01')).window;
assert.equal(w.document.querySelector('img,script,[onerror]'),null);
assert.ok(w.document.querySelector('h1').textContent.includes(attack));
w.close();

const code = esbuild.buildSync({stdin:{contents:'export {summaryCSV} from "./app/Source/YearSummary.jsx";',resolveDir:process.cwd()},bundle:true,format:'iife',globalName:'PublicTest',write:false}).outputFiles[0].text;
const dom = new JSDOM('',{runScripts:'outside-only'});
dom.window.eval(code);
const description = 'A "quoted", multiline\nexpense';
const book = {year:2026,records:[{id:'fixture',month:'January',kind:'expense',scope:'business',category:'Supplies',subCategory:'',description,amount:12,state:'recorded'}],notes:[]};
const report = dom.window.PublicTest.summaryCSV(book,false);
assert.ok(report.includes('"A ""quoted"", multiline\nexpense"'));
book.records[0].description = '=HYPERLINK("https://example.invalid")';
assert.ok(dom.window.PublicTest.summaryCSV(book,false).includes('"\'=HYPERLINK(""https://example.invalid"")"'));
assert.ok(csv([['=1+1','normal',-12]]).includes('"\'=1+1","normal","-12"'));
dom.window.close();
console.log('PASS public export checks: HTML stays text, CSV quotes/newlines and formula-like text are escaped.');
