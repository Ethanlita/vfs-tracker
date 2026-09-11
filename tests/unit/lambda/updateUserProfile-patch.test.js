/** 资料字段补丁契约及DynamoDB更新路径验证。 */
import {it,expect} from 'vitest';
import {buildProfileUpdate} from '../../../lambda-functions/updateUserProfile/profile-update.mjs';
import {updateUserProfileRequestSchema} from '../../../src/api/schemas.js';

it('头像补丁仅修改头像路径，保留名称、隐私与社交字段',()=>{
 const patch={avatarKey:'avatars/new.png'};expect(updateUserProfileRequestSchema.validate({profilePatch:patch}).error).toBeUndefined();
 const command=buildProfileUpdate(patch,'2026-09-11T00:00:00Z');
 expect(command.UpdateExpression).toBe('SET #profile.#field0 = :value0, #updatedAt = :updatedAt');
 expect(command.ExpressionAttributeNames['#field0']).toBe('avatarKey');expect(command.ExpressionAttributeValues[':value0']).toBe(patch.avatarKey);
 expect(command.ConditionExpression).toBe('attribute_type(#profile, :mapType)');
});
it('资料补丁显式清空社交账号及关闭公开，不包含头像路径',()=>{
 const patch={name:'新名称',socials:[],isNamePublic:false,areSocialsPublic:false};
 expect(updateUserProfileRequestSchema.validate({profilePatch:patch}).error).toBeUndefined();const command=buildProfileUpdate(patch,'now');
 expect(Object.values(command.ExpressionAttributeNames)).not.toContain('avatarKey');expect(Object.values(command.ExpressionAttributeValues)).toContain(false);expect(Object.values(command.ExpressionAttributeValues)).toContainEqual([]);
});
it.each([null,[],{}, {nickname:'only'}, {name:''},{avatarKey:12},{isNamePublic:'false'},{socials:[{}]},{unknown:1}])('拒绝无效补丁 %j',profile=>{
 expect(()=>buildProfileUpdate(profile,'now')).toThrow(TypeError);expect(updateUserProfileRequestSchema.validate({profilePatch:profile}).error).toBeDefined();
});
it('兼容旧请求中的Cognito昵称但不写入该字段',()=>{
 const command=buildProfileUpdate({name:'测试',nickname:'Cognito nickname'},'now');expect(Object.values(command.ExpressionAttributeNames)).not.toContain('nickname');
});

it('新补丁请求不使用旧后端会整体替换的profile字段',()=>{expect(updateUserProfileRequestSchema.validate({profile:{avatarKey:'a'}}).error).toBeDefined()});

it('旧完整资料携带setupSkipped时保持该元数据原值',()=>{const command=buildProfileUpdate({name:'新名称',setupSkipped:true},'now');expect(Object.values(command.ExpressionAttributeNames)).not.toContain('setupSkipped')});
