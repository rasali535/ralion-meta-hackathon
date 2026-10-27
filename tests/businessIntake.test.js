import test from 'node:test';import assert from 'node:assert/strict';
import { intakeBusinessContext } from '../src/core/businessIntake.js';
test('accepts HTTPS reference without falsely claiming a crawl',()=>{const c=intakeBusinessContext({website:'https://example.org/store',facts:'Offers baked goods'});assert.equal(c.websiteFetched,false);assert.equal(c.websiteEvidence,null);assert.equal(c.userProvidedFacts,'Offers baked goods')});
test('rejects insecure, credentialed, invalid URLs',()=>{for(const website of ['http://example.org','ftp://example.org','https://user:pass@example.org','not-a-url'])assert.throws(()=>intakeBusinessContext({website}),/Website/);});
test('does not invent business evidence',()=>{const c=intakeBusinessContext({});assert.equal(c.userProvidedFacts,null);assert.equal(c.websiteFetched,false);});
