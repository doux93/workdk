import test from 'node:test';
import assert from 'node:assert/strict';
import {initialWorkspace,validateWorkspace,safeUrl,dateKey} from '../src/workspace.ts';

test('完整备份恢复后保留自定义字段、模块身份和内容',()=>{
 const workspace=initialWorkspace(); const module=workspace.modules[0];
 module.fields=['负责人','地点']; module.entries[0].values={'负责人':'张三','地点':'会议室'};
 module.view='calendar';workspace.layout='focus';workspace.theme='dark';
 const restored=JSON.parse(JSON.stringify(workspace));
 assert.equal(validateWorkspace(restored),true);assert.deepEqual(restored,workspace);
});
test('损坏备份被拒绝，验证器不崩溃',()=>{
 const invalid=[null,{},[],{...initialWorkspace(),modules:[null]}, {...initialWorkspace(),theme:'unknown'}, {...initialWorkspace(),version:2}];
 for(const value of invalid)assert.equal(validateWorkspace(value),false);
 const duplicate=initialWorkspace();duplicate.modules.push(duplicate.modules[0]);assert.equal(validateWorkspace(duplicate),false);
 const badEntry=initialWorkspace();badEntry.modules[0].entries[0].values={x:42};assert.equal(validateWorkspace(badEntry),false);
});
test('切换视图及改名保留模块和记录的身份',()=>{
 const m=initialWorkspace().modules[0];const original=structuredClone(m);
 for(const view of ['board','calendar','notes','links','list'])m.view=view;
 m.name='新的模块名称';assert.equal(m.id,original.id);assert.deepEqual(m.entries,original.entries);
});
test('只允许 HTTP 和 HTTPS 网址',()=>{
 assert.equal(safeUrl('https://example.com/path?q=1'),'https://example.com/path?q=1');
 assert.equal(safeUrl('http://127.0.0.1:8000/'),'http://127.0.0.1:8000/');
 for(const value of ['javascript:alert(1)','data:text/html,test','file:///etc/passwd','not a url',''])assert.equal(safeUrl(value),null);
});
test('日期在月初及年末保持本地日期和补零格式',()=>{
 assert.equal(dateKey(new Date(2026,0,1,23,30)),'2026-01-01');assert.equal(dateKey(new Date(2026,11,31,0,1)),'2026-12-31');
});
