/** @file 使用真实AWS SDK序列化和错误解码，验证条件写入下的幂等行为。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { minimalSelfTest } from '../../../src/test-utils/fixtures/index.js';
import { addEventRequestSchema, addEventResponseSchema, eventIdempotencyErrorSchema } from '../../../src/api/schemas.js';
const storage = vi.hoisted(() => ({ items: new Map(), writes: 0, requests: [], omitOld: false, loseResponse: false }));
vi.mock('@aws-sdk/client-dynamodb', async importOriginal => {
  const actual = await importOriginal();
  const { Readable } = await import('node:stream');
  return { ...actual, DynamoDBClient: class extends actual.DynamoDBClient {
    constructor() {
      super({ region:'us-east-1', credentials:{accessKeyId:'synthetic',secretAccessKey:'synthetic'}, maxAttempts:1,
        requestHandler:{ handle: async request => {
          const input=JSON.parse(request.body);storage.requests.push(input);
          const key=input.Item.userId.S+':'+input.Item.eventId.S;
          let statusCode=200;let body={};
          if(input.ConditionExpression && storage.items.has(key)) {
            statusCode=400;body={__type:'com.amazonaws.dynamodb.v20120810#ConditionalCheckFailedException',message:'exists',
              ...(storage.omitOld?{}:{Item:storage.items.get(key)})};
          }else{
            storage.items.set(key,input.Item);storage.writes++;
            if(storage.loseResponse){storage.loseResponse=false;throw new Error('模拟写入成功后响应丢失');}
          }
          return {response:{statusCode,headers:{'content-type':'application/x-amz-json-1.0'},body:Readable.from([Buffer.from(JSON.stringify(body))])}};
        }}
      });
    }
  }};
});
import { handler } from '../../../lambda-functions/addVoiceEvent/index.mjs';
const data={type:minimalSelfTest.type,date:minimalSelfTest.date,details:minimalSelfTest.details};
/** 构造只有合成已认证claims的请求，不接触真实AWS。 */
const request=(body,owner=minimalSelfTest.userId)=>({httpMethod:'POST',body:JSON.stringify(body),requestContext:{authorizer:{claims:{sub:owner}}}});
beforeEach(()=>{storage.items.clear();storage.writes=0;storage.requests=[];storage.omitOld=false;storage.loseResponse=false;});

describe('事件创建幂等',()=>{
  it('相同请求重复提交返回原ID，保留审核状态和时间戳',async()=>{
    const body={...data,clientRequestId:'stable-request'};
    expect(addEventRequestSchema.validate(body).error).toBeUndefined();
    const first=await handler(request(body));
    const item=[...storage.items.values()][0];item.status={S:'approved'};
    const before=JSON.stringify(item);
    const second=await handler(request(body));
    expect(first.statusCode).toBe(200);expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body)).toEqual(JSON.parse(first.body));
    expect(addEventResponseSchema.validate(JSON.parse(second.body)).error).toBeUndefined();
    expect(storage.writes).toBe(1);expect(JSON.stringify([...storage.items.values()][0])).toBe(before);
    expect(storage.requests[1].ReturnValuesOnConditionCheckFailure).toBe('ALL_OLD');
  });

  it('20次并发相同请求只创建一条事件',async()=>{
    const results=await Promise.all(Array.from({length:20},()=>handler(request({...data,clientRequestId:'concurrent'}))));
    expect(results.every(result=>result.statusCode===200)).toBe(true);
    expect(new Set(results.map(result=>JSON.parse(result.body).eventId)).size).toBe(1);
    expect(storage.writes).toBe(1);
  });

  it('写入成功但响应丢失后重试不会重复创建',async()=>{
    storage.loseResponse=true;
    const body={...data,clientRequestId:'response-lost'};
    expect((await handler(request(body))).statusCode).toBe(500);
    expect((await handler(request(body))).statusCode).toBe(200);
    expect(storage.writes).toBe(1);
  });

  it('同标识不同内容返回409，不覆盖原记录',async()=>{
    await handler(request({...data,clientRequestId:'conflict'}));
    const result=await handler(request({...data,details:{notes:'different'},clientRequestId:'conflict'}));
    expect(result.statusCode).toBe(409);expect(JSON.parse(result.body).errorCode).toBe('IDEMPOTENCY_CONFLICT');
    expect(eventIdempotencyErrorSchema.validate(JSON.parse(result.body)).error).toBeUndefined();
    expect(storage.writes).toBe(1);
  });

  it('嵌套对象键顺序不影响相同请求判断',async()=>{
    const first={...data,details:{notes:'same',nested:{a:1,b:2}},clientRequestId:'order'};
    await handler(request(first));
    const result=await handler(request({...first,details:{nested:{b:2,a:1},notes:'same'}}));
    expect(result.statusCode).toBe(200);expect(storage.writes).toBe(1);
  });

  it('相同标识的不同账号不会共享事件',async()=>{
    const body={...data,clientRequestId:'same-id'};
    const first=await handler(request(body));const second=await handler(request(body,'other-account'));
    expect(JSON.parse(first.body).eventId).not.toBe(JSON.parse(second.body).eventId);
    expect(storage.writes).toBe(2);
  });

  it('同内容不同标识仍可作为两次测量保存',async()=>{
    await handler(request({...data,clientRequestId:'first'}));await handler(request({...data,clientRequestId:'second'}));
    expect(storage.writes).toBe(2);
  });

  it.each(['',null,12,{},'bad id','x'.repeat(129)])('非法请求标识拒绝写入：%j',async clientRequestId=>{
    expect(addEventRequestSchema.validate({...data,clientRequestId}).error).toBeDefined();
    const result=await handler(request({...data,clientRequestId}));
    expect(result.statusCode).toBe(400);expect(storage.writes).toBe(0);
    expect(eventIdempotencyErrorSchema.validate(JSON.parse(result.body)).error).toBeUndefined();
  });

  it('条件失败缺少旧记录时不能误报成功',async()=>{
    const body={...data,clientRequestId:'missing-old'};
    await handler(request(body));storage.omitOld=true;
    expect((await handler(request(body))).statusCode).toBe(500);
    expect(storage.writes).toBe(1);
  });

  it('不携带新字段的旧客户端保持独立创建行为',async()=>{
    await handler(request(data));await handler(request(data));
    expect(storage.writes).toBe(2);
    expect(storage.requests.every(input=>input.ConditionExpression===undefined)).toBe(true);
  });
});
