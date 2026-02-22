import React, { useState, useEffect } from 'react';
import { signIn, signUp, confirmSignUp, resetPassword, confirmResetPassword, resendSignUpCode, confirmSignIn } from 'aws-amplify/auth';
import { Mail, Lock, User, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

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
 */
const Input = ({ icon, type = 'text', name, placeholder, required = true, value, autoComplete, onChange, showPassword, onTogglePassword }) => {
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
 * 自定义认证组件
 * 
 * 提供完全自定义的登录、注册、邮箱验证和密码重置功能
 * 使用 Amplify Auth SDK 直接调用 API
 * 
 * API 兼容 Amplify Authenticator:
 * - 支持 children 函数模式: <CustomAuthenticator>{({ user }) => ...}</CustomAuthenticator>
 * - 支持 hideSignUp prop 隐藏注册功能
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

  // 冷却计时器倒计时
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // 登录
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const result = await signIn({
        username: formData.username,
        password: formData.password
      });
      
      const { isSignedIn, nextStep } = result;
      
      // 检查是否需要修改临时密码
      if (nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        console.log('[CustomAuthenticator] 需要修改临时密码');
        setSuccessMessage('检测到您正在使用临时密码，请设置新密码');
        setMode('forceChangePassword');
        // 清空密码字段，准备输入新密码
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
      } else if (isSignedIn) {
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
      if (err.name === 'UserNotConfirmedException') {
        setLoading(false); // 先关闭登录loading
        setMode('confirmSignUp');
        // 自动重新发送验证码
        try {
          setLoading(true); // 为重发验证码开启loading
          await resendSignUpCode({ username: formData.username });
          setSuccessMessage('验证码已重新发送到您的邮箱，请查收并输入验证码。');
          setResendCooldown(120); // 启动 120 秒冷却
        } catch (resendErr) {
          console.error('[CustomAuthenticator] 自动重发验证码失败:', resendErr);
          setError('您的账号尚未验证邮箱。请在验证页面点击"重新发送"按钮获取验证码。');
        } finally {
          setLoading(false); // 重发操作完成
        }
      } else if (err.name === 'NotAuthorizedException') {
        setError('用户名或密码错误');
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
      const { isSignUpComplete, userId, nextStep } = await signUp({
        username: formData.username,
        password: formData.password,
        options: {
          userAttributes: {
            email: formData.email,
            nickname: formData.nickname || formData.username
          }
        }
      });
      
      console.log('注册结果:', { isSignUpComplete, userId, nextStep });
      
      if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setSuccessMessage('注册成功！请检查您的邮箱并输入验证码。');
        setMode('confirmSignUp');
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
    setLoading(true);
    setError('');
    
    try {
      await confirmSignUp({
        username: formData.username,
        confirmationCode: formData.code
      });
      
      setSuccessMessage('🎉 邮箱验证成功！即将跳转到登录页面...');
      
      // 2秒后跳转到登录页面
      setTimeout(() => {
        setMode('signIn');
        resetForm();
      }, 2000);
      
      return;
    } catch (err) {
      console.error('验证错误:', err);
      if (err.name === 'CodeMismatchException') {
        setError('验证码错误，请重新输入');
      } else if (err.name === 'ExpiredCodeException') {
        setError('验证码已过期，请返回注册页面重新获取');
      } else if (err.name === 'AliasExistsException') {
        setError('该邮箱已被其他用户使用。如果这是您的邮箱，请直接登录或使用忘记密码功能。');
        // 3秒后自动跳转到登录页面
        setTimeout(() => {
          setMode('signIn');
          resetForm();
        }, 3000);
      } else if (err.name === 'UserNotFoundException') {
        setError('用户不存在，请返回注册页面重新注册');
      } else {
        setError(err.message || '验证失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  // 重新发送注册验证码
  const handleResendSignUpCode = async () => {
    if (!formData.username) {
      setError('请输入用户名');
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
      await resendSignUpCode({ username: formData.username });
      setSuccessMessage('验证码已重新发送到您的邮箱，请查收');
      // 启动 120 秒冷却计时器
      setResendCooldown(120);
    } catch (err) {
      console.error('重新发送验证码错误:', err);
      if (err.name === 'UserNotFoundException') {
        setError('用户不存在，请返回注册页面重新注册');
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
              onClick={() => { setMode('confirmSignUp'); setError(''); }}
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
