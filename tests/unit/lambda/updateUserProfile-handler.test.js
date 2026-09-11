/** 更新资料Lambda的鉴权、补丁协议与条件失败边界测试。 */
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const {send}=vi.hoisted(()=>({send:vi.fn()}));
vi.mock('@aws-sdk/client-dynamodb',()=>({DynamoDBClient:class{}}));
vi.mock('@aws-sdk/lib-dynamodb',()=>({DynamoDBDocumentClient:{from:()=>({send})},UpdateCommand:class{constructor(input){this.input=input}}}));
import {handler} from '../../../lambda-functions/updateUserProfile/index.mjs';
/** 构造仅用于测试的已授权网关请求。 */
const event=body=>({httpMethod:'PUT',pathParameters:{userId:'audit-user'},requestContext:{authorizer:{claims:{sub:'audit-user',nickname:'昵称',email:'audit@example.test','cognito:username':'audit'}}},body:JSON.stringify(body)});
beforeEach(()=>{send.mockReset();vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>vi.restoreAllMocks());
it('补丁发送嵌套字段更新，并返回数据库合并后的完整资料',async()=>{
 send.mockResolvedValueOnce({Attributes:{userId:'audit-user',profile:{name:'保留名称',avatarKey:'new.png',isNamePublic:true}}});
 const response=await handler(event({profilePatch:{avatarKey:'new.png'}}));expect(response.statusCode).toBe(200);expect(send.mock.calls[0][0].input.UpdateExpression).not.toContain('profile =');expect(JSON.parse(response.body).user.profile).toMatchObject({name:'保留名称',avatarKey:'new.png',isNamePublic:true});
});
it('不存在资料map时返回409，不另行整体替换资料',async()=>{send.mockRejectedValueOnce(Object.assign(new Error(),{name:'ConditionalCheckFailedException'}));expect((await handler(event({profilePatch:{avatarKey:'a'}}))).statusCode).toBe(409);expect(send).toHaveBeenCalledTimes(1)});
it('跨用户写入仍禁止',async()=>{const request=event({profilePatch:{name:'x'}});request.pathParameters.userId='someone-else';expect((await handler(request)).statusCode).toBe(403);expect(send).not.toHaveBeenCalled()});
it.each([null,[],{}, {profilePatch:{unknown:1}},{profilePatch:{name:'x'},profile:{name:'y'}}])('无效或冲突协议 %j 不写数据库',async body=>{expect((await handler(event(body))).statusCode).toBe(400);expect(send).not.toHaveBeenCalled()});
