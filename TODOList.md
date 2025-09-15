1. # 增加以下后端API：
    1. ~~~查询用户信息API（私有）（已解决）~~~
    2. ~~~查询用户信息API（公用，仅返回公开数据）（已解决）~~~
    3. ~~~编辑用户信息API（私有）（已解决）~~~
    4. ~~~新用户资料完善API（私有）（已解决）~~~
    5. ~~~Gemini代理API（私有）：前端尽量请求逻辑不变，API只是转发带个Key，用来保护Key不泄露（已解决）~~~
2. # 更改以下后端API：
    1. ~~~用于PublicDashboard的all-events API不返回姓名不公开的用户的名字（以“（非公开）”替代）（已解决）~~~
3. # 做好online praat
   1. ~~~详细要求参照online_praat_plan.md（已解决）~~
   2. ~~~细化设计参照online_praat_detailed_plan.md（已解决）~~
   3. ~~~开发计划参照online_praat_development_plan.md（已解决）~~~
4. # 增加图表
    1. ~~~图表增加非仅训练的数据图表（以第一次训练为第0天对齐对齐）（已解决）~~
    2. ~~~图表增加增加无VFS、无训练的图表（以第一次事件为第0天对齐）（已解决）~~
    3. ~~~VFS图表增加Groupby功能，包括只显示某医生，或者某种手术方法（已解决）~~
5. # 增加功能：
    1. ~~~新用户引导和信息完善（已解决）~~
    2. ~~~头像显示 （已解决）~~
    3. ~~~PublicDashboard，用户卡片显示公开事件完整信息（已解决）~~~
    4. ~~~PublicDashboard，用户卡片显示公开资料（已解决）~~~
    5. ~~~个人页面中增加用户信息查看和修改（内置信息（已解决），cognito登录信息（已解决））~~
    6. ~~~PublicDashboard，用户列表里正常显示用户的展示名字（这里不判断是否公开，因为Lambda函数会解决这个问题）（已解决）~~~
6. （远期）实现AWS Lambda和API Gateway自动部署，通过Github Actions，Action Secret已经设置了AWS_ACCESS_KEY和AWS_SECRET_KEY，可以使用IAM角色部署
7. ~~~修复PublicDashboard的间距问题（左右上方均没有间距）（已解决）~~
8. ~~~修复Mypage的间距问题（屏幕在640px-1200px宽度下左右无边距，上方无边距）（已解决）~~
9. ~~~登录后上方头像不是用户头像（用户没有头像时则根据用户名首字母生成一个）（已解决）~~
10. ~~~登录后上方header应该显示用户nickname（使用Cognito管理的），而不是username（已解决）~~~
11. ~~~Mypage里“欢迎，username”，应该将“用户”改为用户的nickname（来自Cognito）（已解决）~~~
12. ~~~登录后访问"https://vfs-tracker.app/"时Timeline.jsx组件没有显示，页面状态仍然和登录前一样 （已解决）~~
13. ~~~Timeline.jsx里面还是会出现示例数据 查找来源 （已解决）~~
14. ~~~Timeline.jsx上方的间距不足（已解决）~~
15. ~~~实现一个Lambda函数，自动Approve事件（规则：非医院测试事件一律自动Approve，医院测试事件调用Gemini，审查附件的内容-应该是嗓音测试报告的照片-是否和用户的输入相符）（已解决）~~~
16. （远期）实现一个管理员页面，允许管理员Approve事件，或者将事件改回Pending，以及其他管理功能（我们应该以何种形式判断管理员账户呢？是直接将ethanlita账户作为管理员，还是整点别的方案？）
17. ~~~EventManager.jsx中无法正常管理事件，事件的删除没有真的实现（已解决）~~
18. ~~~EventManager.jsx和AddEvent.jsx左上角的返回按钮，增加一点间距（已解决）~~~
19. ~~~Profile.jsx左上角加一个返回按钮，样式同EventManager.jsx和AddEvent.jsx（已解决）~~~
20. ~~~确保现在所有的组件都会从AuthContext，以符合Amplify v6的标准方法获取用户数据，而不是从别的奇怪的地方获取用户数据（已解决）~~~
21. （我有点忘记了是什么了）
22. ~~~深层链接失效了（已解决）~~~
23. （远期）优化加载体验，将阻塞式的长加载拆分为非阻塞的渐进式加载，尽快展示UI骨架屏。
24. ~~~上传文件时的类型判定和支持多文件（已解决）~~~
25. ~~~事件删除后，在s3里把对应的附件也删掉（已解决）~~~
26. ~~~Gemini自动审核有问题，Cloudwatch log见多模态上传失败（已完成）~~~
27. （远期）增加一个定期运行的，删除S3中没有被事件引用的附件，以及已经分析完（或者录音被中断而上传后却不使用）的录音文件的Lambda
28. ~~~Gemini鼓励语的修复(现在Gemini似乎只会收到空的Prompt，不知道是前端还是代理请求Lambda函数问题)，并且为其加入知识库，让Gemini根据知识库给出更加有针对性的分析。（已解决）~~~
29. ~~~退出登录后登录其他账户，页面上方的头像和nickname仍是之前登录的用户的（已解决）~~~
30. ~~~PDF报告图表中的中文字符无法正常显示（已解决）~~~
31. ~~~目前分析器保存的事件数据中，基频是元音发音时的基频，并不能很好地反映说话时的情况。让我们将这一基频改为自由发言部分的基频平均值。（已解决）~~~
32. ~~~新功能：本地快速反应简易测试（基频only）-也可以自动增加事件（已解决）~~~
    1. ~~~前端录音并且在本地分析基频（已解决）~~~
    2. ~~~给实时反馈当前基频数值（图表、数值和音阶显示）（已解决）~~~
    3. ~~~新建事件保存当前时间和基频数值（已解决）~~~
    4. ~~~用户可以自行点击开始和停止，停止后就计算刚才那段时间内的平均值，允许用户点击保存事件，或者开始新的录音（已解决）~~~
    5. ~~~在Mypage内现有的按钮右侧新增“快速基频测试”按钮（已解决）~~~
    6. ~~~保存事件时直接复用EventForm那个创建新事件的逻辑得了（已解决）~~~
33. ~~~新功能：爬音阶指导和音域测定（已解决）~~~
    1. ~~~要求用户戴上耳机，并请求录音权限（已解决）~~~
    2. ~~~检查用户是否戴上耳机（播放一段音频然后检测是否有录音）（已解决）~~~
    3A. ~~~给用户演示一遍具体做法，并且要求用户选择一个练习时发的音（如a、i、ne、mei、na等），然后带用户练习一次（可跳过）（已解决）~~~
    3. ~~~共进行一次爬升练习和一次下降练习，爬升练习每个循环提升半个音阶，下降练习每个循环下降半个音阶（已解决）~~~
    4. ~~~爬升练习从中央C开始，先播放一个起始音（即该循环的第一个音），然后从起始音开始向上两个音阶，然后再回到起始音（已解决）~~~
       1. ~~~以中央C开始的循环为例（已解决）~~~
       2. ~~~播放中央C作为起始音（给用户作为参考）（已解决）~~~
       3. ~~~依次播放中央C-D-E-D-中央C，同时录音（已解决）~~~
       4. ~~~检查用户的音高是否达到，如果达到了，则开始下一循环（已解决）~~~
       5. ~~~如果没有达到，允许用户重试这一循环，或者开始下降练习（已解决）~~~
    5. ~~~下降练习从爬升练习中用户到达的最高音开始，每次循环下降半个音，其他的一样（已解决）~~~
    6. ~~~下降练习结束后向用户展示练习成果，显示最高到达音和最低到达音（已解决）~~~
    7. ~~~在Mypage现有的按钮右侧新增“音阶练习”按钮（已解决）~~~
34. ~~~让这个app变得可以被安装（Chrome中“安装”功能）（已解决）~~~
35. ~~~现在在Timeline中查看事件的时候，用户自己上传的附件是可以正常下载的，但是由分析工具生成的pdf报告却不能正常下载，生成的地址是错误的：https://vfs-tracker.app/voice-tests/5d233766-936e-4e7e-8382-da6c6562d5fe/report.pdf，正确的地址应该诸如：https://vfs-tracker-objstor.s3.us-east-1.amazonaws.com/attachments/34f8b418-1011-70a7-633b-720845138963/1755503156343_MVIMG_20250818_134717.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAUKG7MXK5IF6QUGER%2F20250828%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20250828T152840Z&X-Amz-Expires=3600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEFAaCXVzLWVhc3QtMSJHMEUCIQD1iDIbzX6jwChaRTSe4MOjlbr6RhIe9Us2A6GXKHYJKwIgGL4YZLODKfasWtjhZlcR4c8PaZON6cC64SC3P5lOEXUq8QIIqf%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARADGgwyOTY4MjEyNDI1NTQiDPiCcr2pGtROFL0l1CrFAnrIVRL%2BHgchRu%2B8FBkXe%2BQQyLTS2FMqOVtyHHBxoojnIR8ktLNtlj8ev5mnltqwr4QEoijizfa6bkkfuA87bmiKV9VRYRUX%2Fs7hgHeNUln%2FC6GcE%2BqwYgmALYAiJiLVpMXrKcO3VI%2FTL%2FoF5oC%2BhU%2FvOwSm6bmqCF25gapWgwtPVOwQ6%2BAWSPGNXP7spmdjCc3Mf10tVAxM%2FsFvV4rTz%2BVeDWZeHU8hfg43OS36UVPxiAwSercqI3K9SpaRXsfOkUcQaRJvCnn7TBp8rvS9SGoGmQ18owaqQNrCMGR6nUa2PTRfNar03mjWqCzc4kBgedDQUwtSvE%2FQeYkBGg%2Fh9aJgINe7oIACV1VYabUU0lnHwDUdZUAsuWKaQVjJDxviJZA%2BX59Wo5ZdpAB08lCiH2uiW8HdkrRKGRzriOnOAtG0X02XHLMwpevBxQY6ngH47hZB12FXQahDqqfiS%2FJLTmeTNkPb7tHU1P9H%2Fauzgt2Ozdhb3OTdv6U5u1gpFGTNoYTGx%2FtKH%2Beftu8pjjDeMwAhhXQGMy5RTXs2%2FvkRVVUCK%2FfcwsFCeuy1b5oExfjOvcqsNnP4JEc4PSRqS2aJSJ0nNrjXZkZUYA73cOtxSWI8OBnrs4ENBJ%2BEMVp6Vd0kY%2BMUv4W7%2B1jCsfmtNA%3D%3D&X-Amz-Signature=0abf1c94b4018ef0e28685e37dab42422998eaca6ba65c9fd78feadbc1d69c4b&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject（已解决）~~~
36. ~~~VoiceTestWizard中，如果录音时用户说错话了等，允许用户点击“停止录音且放弃”按钮放弃这段录音，点击后向导回到开始这段录音前的状态。原本的停止录音按钮改为“停止录音且继续”（已解决）~~~
37. ~~~在ScalePractice中，显示结果页面新增一个类似于Timeline中的Gemini请求，向Gemini发送用户的音域，然后要求Gemini推荐适合用户演唱的歌曲（已解决）~~~
38. ~~~在VoiceTestWizard中，用户上传完成后的“已录制文件”列表内提供一个回放录音的功能（已解决）~~~
39. ~~~进一步解决Formant-SPL分析的问题（现在Formant-SPL图始终无法在报告里展示）（已解决——）~~~
40. 解决检测限（也就是测不出特定共振峰时把F2当做F1）的问题
41. 增加一个对持续元音的Formant-SPL分析，在分析共振峰的步骤中，使用在第二步中录制的持续元音，选择Jitter和Shimmer最小的录音进行分析
42. 更新多录音选择标准：
    1. 对于测量MPT任务，选择最长的录音
    2. 对于测量基频任务，选择基频最高的录音
    3. 对于上滑音，选择最高基频最高的录音
    4. 对于下滑音，选择最低基频最低的录音
43. 对于MPT测量，不能直接获取音频长度，而是要计算其中有效音频的长度（去掉用户没出声部分）
44. PublicDashboard中的数据展示有问题，增项数据分析和VFS对齐的分析都没有对齐，且似乎不能正确展示医院测试的情况
45. 启用S3加速访问