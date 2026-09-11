/**
 * @file 初始化朗读稿件库
 * @description 仅在固定 passageId 不存在时写入初始稿件，不覆盖管理员后续编辑。
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const tableName = process.env.READING_PASSAGES_TABLE_NAME || 'VoiceFemReadingPassages';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' }));
const now = new Date().toISOString();
const passages = [
  {
    passageId: 'morning-light', title: '第25小时的晨曦', author: '匿名投稿者', enabled: true,
    content: '请不要盯着倒影里的裂痕，便断言那是不可饶恕的错构。我们只是比别人多花了一点时间，才在灵魂深处辨认出自己真正的名字。\n\n哪怕长夜让人怀疑黎明的颜色，太阳也从不会缺席。',
  },
  {
    passageId: 'morning-practice', title: '清晨练习', author: 'VFS Tracker 编辑组', enabled: true,
    content: '清晨的风穿过窗边，我放慢呼吸，用自然的语速说出今天的计划。每一句话都不必匆忙，只要清楚、放松，并让声音平稳地向前。\n\n路上的树影轻轻摇动，新的一天也在普通的问候中开始。',
  },
];

for (const passage of passages) {
  try {
    await db.send(new PutCommand({
      TableName: tableName,
      Item: { ...passage, createdAt: now, updatedAt: now },
      ConditionExpression: 'attribute_not_exists(passageId)',
    }));
    console.log(`已初始化朗读稿件: ${passage.passageId}`);
  } catch (error) {
    if (error?.name !== 'ConditionalCheckFailedException') throw error;
    console.log(`保留现有朗读稿件: ${passage.passageId}`);
  }
}
