import React, { useState } from 'react';
import '../styles/WalletConnect.css';

function WalletConnect({ onConnect }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const connectWallet = async () => {
    setLoading(true);
    setError('');

    try {
      if (!window.ethereum) {
        setError('MetaMask extension not detected. Please install it to use BlockSecure.');
        return;
      }

      // Some providers might be present but not have .request (unlikely for MetaMask but good for safety)
      if (typeof window.ethereum.request !== 'function') {
        setError('Ethereum provider is not compatible with MetaMask API.');
        return;
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        onConnect(accounts[0]);
      }
    } catch (err) {
      setError(err.message || 'Failed to connect wallet');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wallet-connect-container">
      <div className="wallet-card">
        <div className="wallet-header">
          <div className="card-fox">🦊</div>
          <h2>Connect Your Wallet</h2>
          <p className="reference-subtitle">
            To use BlockSecure, connect your MetaMask wallet.
          </p>
        </div>

        {error && (
          <div className="error-banner">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
          </div>
        )}

        {!window.ethereum ? (
          <a 
            href="https://metamask.io/download/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="connect-button-premium install-btn"
            style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}
          >
            Install MetaMask
          </a>
        ) : (
          <button
            className="connect-button-premium"
            onClick={connectWallet}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Connecting...
              </>
            ) : (
              'Connect MetaMask'
            )}
          </button>
        )}

        <div className="card-divider"></div>

        <div className="feature-grid">
          <div className="refinement-feature-card">
            <div className="feature-icon-box">🛡️</div>
            <h4>Requirements</h4>
            <ul className="feature-list-minimal">
              <li>MetaMask Browser Extension</li>
              <li>Connected: Ganache / Sepolia</li>
              <li>Gas ready (~0.001 ETH)</li>
            </ul>
          </div>

          <div className="refinement-feature-card">
            <div className="feature-icon-box">⚙️</div>
            <h4>Setup Guide</h4>
            <ul className="feature-list-minimal">
              <li>Install at <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="premium-link">metamask.io</a></li>
              <li>Secure your Seed Phrase</li>
              <li>Handshake with BlockSecure</li>
            </ul>
          </div>
        </div>

        <div className="handshake-status">
          <span className="status-dot-pulse"></span>
          Gateway Ready: Waiting for handshake
        </div>
      </div>
    </div>
  );
}

export default WalletConnect;
