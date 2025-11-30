import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { generateRSAKeyPair, exportPublicKey, exportPrivateKey } from '../utils/crypto';
import { storePrivateKey } from '../utils/keyStorage';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    keyType: 'RSA-2048' // Default to RSA-2048
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setLoading(true);
    setGeneratingKeys(true);

    try {
      // Step 1: Generate cryptographic key pair
      let keyPair;
      let algorithm = 'RSA-OAEP';
      let keySize = '2048';

      if (formData.keyType === 'RSA-2048') {
        keyPair = await generateRSAKeyPair(2048);
        algorithm = 'RSA-OAEP';
        keySize = '2048';
      } else if (formData.keyType === 'RSA-3072') {
        keyPair = await generateRSAKeyPair(3072);
        algorithm = 'RSA-OAEP';
        keySize = '3072';
      } else {
        throw new Error('Invalid key type selected');
      }

      // Step 2: Export keys
      const publicKeyBase64 = await exportPublicKey(keyPair.publicKey);
      const privateKeyBase64 = await exportPrivateKey(keyPair.privateKey);

      setGeneratingKeys(false);

      // Step 3: Store private key locally in IndexedDB
      await storePrivateKey(formData.username, privateKeyBase64, algorithm, keySize);

      // Step 4: Register user with server (sends public key)
      const response = await api.post('/auth/register', {
        username: formData.username,
        password: formData.password,
        publicKey: publicKeyBase64
      });

      if (response.data.success) {
        // Store token
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('username', formData.username);
        localStorage.setItem('userId', response.data.user.id);

        // Navigate to chat
        navigate('/chat');
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || err.message || 'Registration failed');
      setGeneratingKeys(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Register</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={30}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="keyType">Key Type</label>
            <select
              id="keyType"
              name="keyType"
              value={formData.keyType}
              onChange={handleChange}
              className="form-select"
            >
              <option value="RSA-2048">RSA-2048 (Recommended)</option>
              <option value="RSA-3072">RSA-3072 (Higher Security)</option>
            </select>
            <small className="form-hint">Your private key will be stored securely on this device only.</small>
          </div>
          {error && <div className="error-message">{error}</div>}
          {generatingKeys && (
            <div className="info-message">Generating cryptographic keys... This may take a moment.</div>
          )}
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (generatingKeys ? 'Generating Keys...' : 'Registering...') : 'Register'}
          </button>
        </form>
        <p className="auth-link">
          Already have an account? <a href="/login">Login here</a>
        </p>
      </div>
    </div>
  );
};

export default Register;

