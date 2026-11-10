import {initialWorkspace,dateKey} from '../src/workspace.ts';

export function createLargeWorkspace(count){
  const workspace=initialWorkspace();
  workspace.example=false;
  const module={id:'load-module',name:'我的单词本',description:'合成数据，仅用于测试',icon:'book',color:'green',view:'list',fields:['中文释义','例句','熟悉程度','学习时长（分钟）'],hidden:false,entries:[]};
  for(let index=0;index<count;index++)module.entries.push({id:`entry-${index}`,title:`单词 ${index}`,description:`benchmark-value-${index}。用于测试搜索与记录展示。`,status:'todo',priority:'普通',date:dateKey(),time:'',url:'https://example.com/',values:{中文释义:`释义 ${index}`,例句:`This is example ${index}.`,熟悉程度:'基本掌握','学习时长（分钟）':String(index%90)},created:'2026-11-10T00:00:00.000Z',sample:false});
  workspace.modules=[module];
  return workspace;
}
