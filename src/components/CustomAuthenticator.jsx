import React, { useState, useEffect } from 'react';
import { signIn, signUp, confirmSignUp, resetPassword, confirmResetPassword, resendSignUpCode, confirmSignIn } from 'aws-amplify/auth';
import { Mail, Lock, User, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { savePendingSignUp, loadPendingSignUp, clearPendingSignUp, looksLikeEmail } from '../utils/pendingSignUp.js';

/**
 * 输入框组件
 * @param {Object} props
 * @param {React.Component} props.icon - 图标组件
 * @param {string} props.type - 输入类型
 * @param {string} props.name - 字段名
 * @param {string} props.placeholder - 占位符
 * @param {boolean} props.required - 是否必填
 * @param {string} props.value - 当前值
 * @param {string} props.autoComplete - 自动完成属性
 * @param {Function} props.onChange - 变化处理函数
 * @param {boolean} props.showPassword - 是否显示密码（密码框专用）
 * @param {Function} props.onTogglePassword - 切换密码显示（密码框专用）
 * @param {string} [props.inputMode] - 移动端虚拟键盘类型提示（如 numeric，用于验证码输入）
 */
const Input = ({ icon, type = 'text', name, placeholder, required = true, value, autoComplete, onChange, showPassword, onTogglePassword, inputMode }) => {
  const InputIcon = icon;

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <InputIcon className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type={type === 'password' && showPassword ? 'text' : type}
        name={name}
        value={value}
        onChange={onChange}
        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
      />
      {type === 'password' && onTogglePassword && (
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
        >
          {showPassword ? (
            <EyeOff className="h-5 w-5 text-gray-400" />
          ) : (
            <Eye className="h-5 w-5 text-gray-400" />
          )}
        </button>
      )}
    </div>
  );
};

/**
 * @param {Object} props
 * @param {string} props.type - 按钮类型
 * @param {Function} props.onClick - 点击处理函数
 * @param {React.ReactNode} props.children - 子元素
 * @param {string} props.variant - 样式变体
 * @param {boolean} props.disabled - 是否禁用
 * @param {boolean} props.loading - 是否加载中
 */
const Button = ({ type = 'submit', onClick, children, variant = 'primary', disabled = false, loading = false }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || loading}
    className={`w-full flex items-center justify-center px-4 py-2 rounded-lg font-semibold transition-colors ${
      variant === 'primary'
        ? 'bg-pink-600 text-white hover:bg-pink-700 disabled:bg-gray-400'
        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
    }`}
  >
    {loading ? (
      <Loader2 className="h-5 w-5 animate-spin" />
    ) : (
      children
    )}
  </button>
);

/**
 * [CN] 在必须使用"注册用户名"的场景（邮箱验证、重发验证码）里，用户误填邮箱时的提示。
 * Cognito 的邮箱别名只在邮箱验证通过后才生效，未验证账号只能用注册用户名定位（Issue #89）。
 */
const IDENTIFIER_HINT = '未完成邮箱验证的账号只能用注册时填写的用户名来验证，验证完成前邮箱还不能作为登录名，请改为输入用户名。';

/**
 * 自定义认证组件
 * 
 * 提供完全自定义的登录、注册、邮箱验证和密码重置功能
 * 使用 Amplify Auth SDK 直接调用 API
 * 
 * API 兼容 Amplify Authenticator:
 * - 支持 children 函数模式: <CustomAuthenticator>{({ user }) => ...}</CustomAuthenticator>
 * - 支持 hideSignUp prop 隐藏注册功能
 *
 * 邮箱补充验证（Issue #89）：
 * - 注册成功后把待验证账号写入 localStorage，用户回访登录页时提示"继续验证"并预填用户名
 * - 验证页与重发验证码在检测到填的是邮箱时直接提示改用用户名，不再向 Cognito 发起注定失败的请求
 * - 验证成功后立即回到登录页并保留用户名，避免重复提交
 * 
 * @param {Object} props
 * @param {Function} [props.children] - 认证成功后的渲染函数，接收 { user } 参数（兼容 Amplify）
 * @param {boolean} [props.hideSignUp=false] - 是否隐藏注册链接
 * @returns {JSX.Element}
 */
const CustomAuthenticator = ({ children, hideSignUp = false }) => {
  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp' | 'confirmSignUp' | 'forgotPassword' | 'confirmReset' | 'forceChangePassword'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // 重新发送验证码的冷却计时器
  const [resendCooldown, setResendCooldown] = useState(0);

  // 本设备上"已注册但尚未完成邮箱验证"的账号记录（Issue #89）
  const [pendingSignUp, setPendingSignUp] = useState(() => loadPendingSignUp());
  
  // 表单数据
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    nickname: '',
    confirmPassword: '',
    code: ''
  });

  // 重置表单
  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      nickname: '',
      confirmPassword: '',
      code: ''
    });
    setError('');
    setSuccessMessage('');
  };

  // 处理输入变化
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  /**
   * 记录待验证账号并同步到组件状态
   * @param {string} username - 注册用户名
   * @param {string} [email] - 注册邮箱（登录路径下拿不到时留空，会沿用已记录的邮箱）
   * @returns {{username: string, email: string, createdAt: number}|null} 写入的记录
   */
  const rememberPendingSignUp = (username, email = '') => {
    const record = savePendingSignUp({ username, email });
    setPendingSignUp(record);
    return record;
  };

  /** 清除待验证账号记录（验证完成、账号已失效或用户选择不再提示） */
  const forgetPendingSignUp = () => {
    clearPendingSignUp();
    setPendingSignUp(null);
  };

  /**
   * 判断输入的用户名/邮箱是否对应当前记录的待验证账号
   * @param {string} identifier - 用户输入的用户名或邮箱
   * @returns {boolean} 匹配时返回 true
   */
  const matchesPendingSignUp = (identifier) => {
    if (!pendingSignUp || !identifier) return false;
    const normalized = identifier.trim().toLowerCase();
    return pendingSignUp.username.toLowerCase() === normalized
      || (!!pendingSignUp.email && pendingSignUp.email.toLowerCase() === normalized);
  };

  /**
   * 进入邮箱验证页并预填用户名与邮箱
   * @param {{username?: string, email?: string}} [prefill] - 预填内容
   */
  const openConfirmSignUp = ({ username = '', email = '' } = {}) => {
    setFormData(prev => ({ ...prev, username, email, code: '' }));
    setError('');
    setSuccessMessage('');
    setMode('confirmSignUp');
  };

  /**
   * 邮箱验证完成（或发现账号早已验证）后的统一收尾：清除待验证记录、回到登录页并保留用户名
   * @param {string} username - 已验证的用户名
   * @param {string} message - 展示在登录页的提示
   */
  const finishConfirmation = (username, message) => {
    if (matchesPendingSignUp(username)) {
      forgetPendingSignUp();
    }
    setFormData(prev => ({ ...prev, username, password: '', confirmPassword: '', code: '' }));
    setError('');
    setSuccessMessage(message);
    setMode('signIn');
  };

  // 冷却计时器倒计时
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  /**
   * 提交登录并按照 Amplify v6 的 nextStep 推进认证流程。
   * @param {React.FormEvent<HTMLFormElement>} e - 登录表单提交事件
   * @returns {Promise<void>} 完成登录或显示下一步所需的界面
   */
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 去掉首尾空格，避免移动端输入法自动补上的空格导致认证失败
    const username = formData.username.trim();

    try {
      const result = await signIn({
        username,
        password: formData.password
      });
      
      const { isSignedIn, nextStep } = result;
      
      // SDK 将未验证账号异常转换为正常返回值，统一在 nextStep 分支处理。
      if (nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        const record = rememberPendingSignUp(username);
        openConfirmSignUp({ username, email: record?.email || '' });
        // 自动重发失败时保留验证页面，让用户继续使用已有验证码或手动重试。
        try {
          await resendSignUpCode({ username });
          setSuccessMessage('验证码已重新发送到您的邮箱，请查收并输入验证码。');
          setResendCooldown(120);
        } catch (resendErr) {
          console.error('[CustomAuthenticator] 自动重发验证码失败:', resendErr);
          setError('您的账号尚未验证邮箱。请在验证页面点击"重新发送"按钮获取验证码。');
        }
      // 检查是否需要修改临时密码
      } else if (nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        console.log('[CustomAuthenticator] 需要修改临时密码');
        setSuccessMessage('检测到您正在使用临时密码，请设置新密码');
        setMode('forceChangePassword');
        // 清空密码字段，准备输入新密码
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      } else if (isSignedIn) {
        // 能登录说明该账号已完成验证，清除本设备上对应的待验证记录
        if (matchesPendingSignUp(username)) {
          forgetPendingSignUp();
        }
        // 登录成功，获取当前用户信息并调用 children 函数（兼容 Amplify API）
        try {
          const { getCurrentUser } = await import('aws-amplify/auth');
          const user = await getCurrentUser();
          console.log('[CustomAuthenticator] 登录成功，用户:', user);
          
          // 如果提供了 children 函数，调用它（Amplify 标准模式）
          if (typeof children === 'function') {
            children({ user });
          }
        } catch (userErr) {
          console.error('[CustomAuthenticator] 获取用户信息失败:', userErr);
          setError('登录成功，但无法获取用户信息。请刷新页面或重新登录。');
        }
      }
    } catch (err) {
      console.error('登录错误:', err);
      if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
        // 用户池开启"防止用户存在性错误"后，用未验证账号的邮箱登录也只会返回 NotAuthorized；
        // 若本设备记录了对应的待验证账号，给出更有针对性的提示（Issue #89）
        if (looksLikeEmail(username) && matchesPendingSignUp(username)) {
          setError(`邮箱 ${username} 对应的账号「${pendingSignUp.username}」尚未完成邮箱验证，验证完成前无法用邮箱登录，请先点击上方“继续验证”。`);
        } else {
          setError('用户名或密码错误');
        }
      } else {
        setError(err.message || '登录失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 注册
  const handleSignUp = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // 去掉首尾空格，避免移动端输入法自动补上的空格写进 Cognito
      const username = formData.username.trim();
      const email = formData.email.trim();
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username,
        password: formData.password,
        options: {
          userAttributes: {
            email,
            nickname: formData.nickname.trim() || username
          }
        }
      });
      
      console.log('注册结果:', { isSignUpComplete, userId, nextStep });
      
      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        // 记录待验证账号：用户若中途离开，下次回到登录页可直接"继续验证"（Issue #89）
        rememberPendingSignUp(username, email);
        openConfirmSignUp({ username, email });
        setSuccessMessage('注册成功！请检查您的邮箱并输入验证码。');
      } else if (isSignUpComplete) {
        setSuccessMessage('注册成功！请登录。');
        setMode('signIn');
        resetForm();
      }
    } catch (err) {
      console.error('注册错误:', err);
      if (err.name === 'UsernameExistsException') {
        // 用户名已存在，可能是未验证的账号
        setError('该用户名已被注册。如果您已注册但未验证邮箱，请点击上方"去验证邮箱"链接完成验证。');
      } else if (err.name === 'InvalidPasswordException') {
        setError('密码强度不足：至少8个字符，包含大小写字母、数字和特殊字符');
      } else if (err.name === 'InvalidParameterException') {
        // 可能是邮箱格式错误或其他参数问题
        if (err.message.includes('email')) {
          setError('邮箱格式不正确，请检查后重试');
        } else {
          setError('输入参数有误：' + (err.message || '请检查您的输入'));
        }
      } else if (err.message && err.message.includes('email')) {
        setError('该邮箱已被注册，请使用其他邮箱或直接登录');
      } else {
        setError(err.message || '注册失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 确认注册（验证邮箱）
  const handleConfirmSignUp = async (e) => {
    e.preventDefault();
    const username = formData.username.trim();
    const code = formData.code.trim();

    // 未验证账号无法通过邮箱别名定位，填了邮箱就不再发起注定失败的请求（Issue #89）
    if (looksLikeEmail(username)) {
      setError(IDENTIFIER_HINT);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await confirmSignUp({
        username,
        confirmationCode: code
      });
      finishConfirmation(username, '🎉 邮箱验证成功！请使用您的账号登录。');
    } catch (err) {
      console.error('验证错误:', err);
      if (err.name === 'CodeMismatchException') {
        setError('验证码错误。请确认输入的是最新一封邮件中的验证码，多次重发时以最后收到的为准。');
      } else if (err.name === 'ExpiredCodeException') {
        setError('验证码已过期或无效，请点击下方“重新发送验证码”获取新的验证码。');
      } else if (err.name === 'NotAuthorizedException' && /CONFIRMED/i.test(err.message || '')) {
        // 账号早已验证完成（例如上次验证成功但页面没来得及提示），直接引导登录
        finishConfirmation(username, '该账号已经完成邮箱验证，请直接登录。');
      } else if (err.name === 'NotAuthorizedException') {
        setError('无法验证该账号。请确认输入的是注册时填写的用户名，并且验证码来自最新一封邮件。');
      } else if (err.name === 'AliasExistsException') {
        // 邮箱已被另一个已验证账号占用，这个账号无法再完成验证，本设备的待验证记录也不再有意义
        if (matchesPendingSignUp(username)) {
          forgetPendingSignUp();
        }
        setError('该邮箱已被其他账号使用。如果这是您的邮箱，请直接用它登录，或使用“忘记密码”找回该账号。');
      } else if (err.name === 'UserNotFoundException') {
        if (matchesPendingSignUp(username)) {
          forgetPendingSignUp();
        }
        setError('未找到该用户名对应的账号。请确认输入的是注册用户名；超过 7 天未验证的账号会被自动清理，需要重新注册。');
      } else {
        setError(err.message || '验证失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 重新发送注册验证码
  const handleResendSignUpCode = async () => {
    const username = formData.username.trim();
    if (!username) {
      setError('请输入用户名');
      return;
    }

    // 用邮箱重发时 Cognito 找不到未验证账号，开启"防止用户存在性错误"后甚至会假装成功（Issue #89）
    if (looksLikeEmail(username)) {
      setError(IDENTIFIER_HINT);
      return;
    }

    // 检查冷却时间
    if (resendCooldown > 0) {
      setError(`请等待 ${resendCooldown} 秒后再重新发送`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await resendSignUpCode({ username });
      setSuccessMessage('验证码已重新发送到您的邮箱，请查收，并以最新一封邮件中的验证码为准');
      // 启动 120 秒冷却计时器
      setResendCooldown(120);
    } catch (err) {
      console.error('重新发送验证码错误:', err);
      if (err.name === 'UserNotFoundException') {
        setError('未找到该用户名对应的账号。请确认输入的是注册用户名；超过 7 天未验证的账号会被自动清理，需要重新注册。');
      } else if (err.name === 'LimitExceededException') {
        setError('请求过于频繁，请稍后再试');
      } else {
        setError(err.message || '发送验证码失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 忘记密码
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await resetPassword({ username: formData.username });
      setSuccessMessage('重置密码的验证码已发送到您的邮箱');
      setMode('confirmReset');
    } catch (err) {
      console.error('重置密码错误:', err);
      setError(err.message || '发送验证码失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 确认重置密码
  const handleConfirmReset = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await confirmResetPassword({
        username: formData.username,
        confirmationCode: formData.code,
        newPassword: formData.password
      });
      
      setLoading(false); // 重置成功，关闭加载状态
      setSuccessMessage('✅ 密码重置成功！即将跳转到登录页面...');
      
      // 2秒后跳转到登录页面
      setTimeout(() => {
        setMode('signIn');
        resetForm();
      }, 2000);
      
      return; // 提前返回，不执行 finally 块
    } catch (err) {
      console.error('确认重置错误:', err);
      if (err.name === 'CodeMismatchException') {
        setError('验证码错误');
      } else if (err.name === 'ExpiredCodeException') {
        setError('验证码已过期，请重新获取');
      } else {
        setError(err.message || '密码重置失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 强制修改临时密码
  const handleForceChangePassword = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    
    if (!formData.password || formData.password.length < 8) {
      setError('密码至少需要8个字符');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // 使用 confirmSignIn 完成临时密码修改
      await confirmSignIn({
        challengeResponse: formData.password
      });
      
      // 修改成功，获取用户信息并完成登录
      try {
        const { getCurrentUser } = await import('aws-amplify/auth');
        const user = await getCurrentUser();
        console.log('[CustomAuthenticator] 临时密码修改成功，登录完成:', user);
        
        setSuccessMessage('密码修改成功！正在登录...');
        
        // 调用 children 函数完成登录流程
        if (typeof children === 'function') {
          children({ user });
        }
      } catch (userErr) {
        console.error('[CustomAuthenticator] 密码修改成功，但获取用户信息失败:', userErr);
        setError('密码已修改成功，但登录信息获取失败。请刷新页面或重新登录。');
      }
    } catch (err) {
      console.error('修改临时密码错误:', err);
      if (err.name === 'InvalidPasswordException') {
        setError('密码强度不足：至少8个字符，包含大小写字母、数字和特殊字符');
      } else if (err.name === 'LimitExceededException') {
        setError('尝试次数过多，请稍后再试');
      } else {
        setError(err.message || '密码修改失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 待验证账号提示：登录页/注册页提醒用户本设备上还有未完成邮箱验证的账号（Issue #89）
   * @returns {JSX.Element|null} 提示块；没有记录时返回 null
   */
  const renderPendingSignUpNotice = () => {
    if (!pendingSignUp) return null;
    const emailPart = pendingSignUp.email ? `，验证码会发送到 ${pendingSignUp.email}` : '';
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm space-y-2" role="status">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{`账号「${pendingSignUp.username}」尚未完成邮箱验证${emailPart}。验证完成前无法登录，也不能用邮箱作为登录名。`}</span>
        </div>
        <div className="flex items-center gap-4 pl-7">
          <button
            type="button"
            onClick={() => openConfirmSignUp({ username: pendingSignUp.username, email: pendingSignUp.email })}
            className="font-medium text-pink-600 hover:text-pink-500"
          >
            继续验证
          </button>
          <button
            type="button"
            onClick={forgetPendingSignUp}
            className="text-amber-700 hover:text-amber-900"
          >
            不再提示
          </button>
        </div>
      </div>
    );
  };

  // 渲染登录表单
  if (mode === 'signIn') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">登录</h2>
          {!hideSignUp && (
            <p className="mt-2 text-sm text-gray-600">
              还没有账号？{' '}
              <button
                onClick={() => { setMode('signUp'); resetForm(); }}
                className="text-pink-600 hover:text-pink-500 font-medium"
              >
                立即注册
              </button>
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {renderPendingSignUpNotice()}

        <form onSubmit={handleSignIn} className="space-y-4">
          <Input
            icon={User}
            name="username"
            placeholder="用户名或邮箱"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
          />
          <Input
            icon={Lock}
            type="password"
            name="password"
            placeholder="密码"
            value={formData.password}
            onChange={handleChange}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            autoComplete="current-password"
          />
          
          <div className="text-right">
            <button
              type="button"
              onClick={() => { setMode('forgotPassword'); resetForm(); }}
              className="text-sm text-pink-600 hover:text-pink-500"
            >
              忘记密码？
            </button>
          </div>

          <Button type="submit" loading={loading}>登录</Button>
        </form>
      </div>
    );
  }

  // 渲染注册表单
  if (mode === 'signUp') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">注册</h2>
          <p className="mt-2 text-sm text-gray-600">
            已有账号？{' '}
            <button
              type="button"
              onClick={() => { setMode('signIn'); resetForm(); }}
              className="text-pink-600 hover:text-pink-500 font-medium"
            >
              立即登录
            </button>
          </p>

          <p className="mt-1 text-sm text-gray-600">
            已注册但还没验证？{' '}
            <button
              type="button"
              onClick={() => openConfirmSignUp({
                username: formData.username.trim() || pendingSignUp?.username || '',
                email: formData.email.trim() || pendingSignUp?.email || ''
              })}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              去验证邮箱
            </button>
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {renderPendingSignUpNotice()}

        <form onSubmit={handleSignUp} className="space-y-4">
          <Input
            icon={User}
            name="username"
            placeholder="用户名"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
          />
          <Input
            icon={Mail}
            type="email"
            name="email"
            placeholder="邮箱"
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
          />
          <Input
            icon={User}
            name="nickname"
            placeholder="昵称（可选）"
            required={false}
            value={formData.nickname}
            onChange={handleChange}
          />
          <Input
            icon={Lock}
            type="password"
            name="password"
            placeholder="密码（至少8位，包含大小写字母、数字和特殊字符）"
            value={formData.password}
            onChange={handleChange}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            autoComplete="new-password"
          />
          <Input
            icon={Lock}
            type="password"
            name="confirmPassword"
            placeholder="确认密码"
            value={formData.confirmPassword}
            onChange={handleChange}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading}>注册</Button>
        </form>
      </div>
    );
  }

  // 渲染邮箱验证表单
  if (mode === 'confirmSignUp') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">验证邮箱</h2>
          <p className="mt-2 text-sm text-gray-600">
            我们已向 <span className="font-semibold">{formData.email || '您的邮箱'}</span> 发送验证码
          </p>
          <p className="mt-1 text-xs text-gray-500">
            请检查您的收件箱和垃圾邮件文件夹
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleConfirmSignUp} className="space-y-4">
          <div className="space-y-1">
            <Input
              icon={User}
              name="username"
              placeholder="注册用户名"
              value={formData.username}
              onChange={handleChange}
              autoComplete="username"
            />
            {/* 未验证账号只能用注册用户名定位，填了邮箱时立即提醒（Issue #89） */}
            {looksLikeEmail(formData.username) ? (
              <p className="text-xs text-red-600">{IDENTIFIER_HINT}</p>
            ) : (
              <p className="text-xs text-gray-500">请填写注册时设置的用户名，而不是邮箱。</p>
            )}
          </div>
          <Input
            icon={Mail}
            name="code"
            placeholder="验证码"
            value={formData.code}
            onChange={handleChange}
            autoComplete="one-time-code"
            inputMode="numeric"
          />

          <Button type="submit" loading={loading}>验证</Button>
          
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResendSignUpCode}
              disabled={loading || resendCooldown > 0}
              className="text-pink-600 hover:text-pink-500 disabled:text-gray-400"
            >
              {resendCooldown > 0 ? `重新发送 (${resendCooldown}s)` : '重新发送验证码'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('signIn'); resetForm(); }}
              className="text-gray-600 hover:text-gray-800"
            >
              返回登录
            </button>
          </div>
        </form>
      </div>
    );
  }

  // 渲染忘记密码表单
  if (mode === 'forgotPassword') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">重置密码</h2>
          <p className="mt-2 text-sm text-gray-600">
            输入您的用户名，我们将发送验证码到您的邮箱
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleForgotPassword} className="space-y-4">
          <Input
            icon={User}
            name="username"
            placeholder="用户名"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
          />

          <Button type="submit" loading={loading}>发送验证码</Button>
          
          <button
            type="button"
            onClick={() => { setMode('signIn'); resetForm(); }}
            className="w-full text-sm text-gray-600 hover:text-gray-800"
          >
            返回登录
          </button>
        </form>
      </div>
    );
  }

  // 渲染确认重置密码表单
  if (mode === 'confirmReset') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">设置新密码</h2>
          <p className="mt-2 text-sm text-gray-600">
            输入验证码和新密码
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleConfirmReset} className="space-y-4">
          <Input
            icon={User}
            name="username"
            placeholder="用户名"
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
          />
          <Input
            icon={Mail}
            name="code"
            placeholder="验证码"
            value={formData.code}
            onChange={handleChange}
            autoComplete="one-time-code"
          />
          <Input
            icon={Lock}
            type="password"
            name="password"
            placeholder="新密码"
            value={formData.password}
            onChange={handleChange}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            autoComplete="new-password"
          />
          <Input
            icon={Lock}
            type="password"
            name="confirmPassword"
            placeholder="确认新密码"
            value={formData.confirmPassword}
            onChange={handleChange}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading}>重置密码</Button>
          
          <button
            type="button"
            onClick={() => { setMode('signIn'); resetForm(); }}
            className="w-full text-sm text-gray-600 hover:text-gray-800"
          >
            返回登录
          </button>
        </form>
      </div>
    );
  }

  // 渲染强制修改临时密码表单
  if (mode === 'forceChangePassword') {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">修改临时密码</h2>
          <p className="mt-2 text-sm text-gray-600">
            您正在使用临时密码，请设置一个新密码以继续
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm">
          <p className="font-semibold mb-1">密码要求：</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>至少 8 个字符</li>
            <li>包含大写字母 (A-Z)</li>
            <li>包含小写字母 (a-z)</li>
            <li>包含数字 (0-9)</li>
            <li>包含特殊字符 (!@#$%^&* 等)</li>
          </ul>
        </div>

        <form onSubmit={handleForceChangePassword} className="space-y-4">
          <Input
            icon={Lock}
            type="password"
            name="password"
            placeholder="新密码"
            value={formData.password}
            onChange={handleChange}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            autoComplete="new-password"
          />
          <Input
            icon={Lock}
            type="password"
            name="confirmPassword"
            placeholder="确认新密码"
            value={formData.confirmPassword}
            onChange={handleChange}
            showPassword={showPassword}
            onTogglePassword={() => setShowPassword(!showPassword)}
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading}>设置新密码并登录</Button>
        </form>
      </div>
    );
  }

  return null;
};

export default CustomAuthenticator;
