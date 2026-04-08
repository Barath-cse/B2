import React from 'react';
import '../styles/GettingStarted.css';

function GettingStarted({ setActiveTab }) {
  return (
    <div className="getting-started-container">
      <header className="intro-hero">
        <h2> Welcome to BlockSecure!</h2>
        <p>
          Your decentralized portal for military-grade file integrity and secure sharing. 
          Follow this 3-minute guide to master the platform.
        </p>
      </header>

      {/* ⚡ Quick Start (3 minutes) */}
      <section className="section-container">
        <h4 className="section-header">⚡ Quick Start (3 minutes)</h4>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h5>Upload a File</h5>
            <p>Securely encrypt and store your data on the decentralized web.</p>
            <div className="step-details">
              <ul>
                <li>Go to "Secure Upload" tab</li>
                <li>Drag & drop or select your file</li>
                <li>Click "Upload & Encrypt"</li>
                <li><b>Save your File ID and Encryption Key!</b></li>
              </ul>
            </div>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <h5>Verify & Download</h5>
            <p>Ensure your files are authentic and recover them instantly.</p>
            <div className="step-details">
              <ul>
                <li>Go to "Verify Integrity" tab</li>
                <li>Enter your File ID and Hash Details</li>
                <li>Download and verify the encrypted file</li>
                <li>Use your key to decrypt and access</li>
              </ul>
            </div>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <h5>Share with Others</h5>
            <p>Manage permissions and grant access to trusted recipients.</p>
            <div className="step-details">
              <ul>
                <li>Go to "Access Control" tab</li>
                <li>Enter recipient's wallet address</li>
                <li>Grant access via Smart Contract</li>
                <li>Share the File ID and Key securely</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ✨ Key Features */}
      <section className="section-container">
        <h4 className="section-header">✨ Key Features</h4>
        <div className="features-grid">
          <div className="feature-item">
            <span className="feature-icon">🔐</span>
            <div>
              <strong>End-to-End Encryption</strong>
              <p>AES-256 encryption happens locally in your browser.</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✅</span>
            <div>
              <strong>Tamper Detection</strong>
              <p>SHA-256 hashing detects any unauthorized changes.</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">⛓️</span>
            <div>
              <strong>Blockchain Verification</strong>
              <p>File proof is immutably registered on Ethereum.</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🔑</span>
            <div>
              <strong>Wallet Authentication</strong>
              <p>Zero-knowledge login via your MetaMask wallet.</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">👥</span>
            <div>
              <strong>Controlled Sharing</strong>
              <p>Smart contract based granular access management.</p>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">🛡️</span>
            <div>
              <strong>Decentralized Security</strong>
              <p>Absolute privacy - you are the sole custodian.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 🔄 How It Works */}
      <section className="section-container">
        <h4 className="section-header">🔄 How It Works</h4>
        <div className="workflow-diagram">
          <div className="workflow-step-mini">
            <div className="workflow-icon-mini">📤</div>
            <div className="workflow-text-mini">
              <strong>Upload</strong><br/>
              Encrypt → Hash → Store
            </div>
          </div>
          <div className="workflow-arrow-mini">→</div>
          <div className="workflow-step-mini">
            <div className="workflow-icon-mini">⛓️</div>
            <div className="workflow-text-mini">
              <strong>Blockchain</strong><br/>
              Register Hash ID
            </div>
          </div>
          <div className="workflow-arrow-mini">→</div>
          <div className="workflow-step-mini">
            <div className="workflow-icon-mini">✅</div>
            <div className="workflow-text-mini">
              <strong>Verify</strong><br/>
              Compare Integrity
            </div>
          </div>
          <div className="workflow-arrow-mini">→</div>
          <div className="workflow-step-mini">
            <div className="workflow-icon-mini">🔓</div>
            <div className="workflow-text-mini">
              <strong>Decrypt</strong><br/>
              Access Content
            </div>
          </div>
        </div>
      </section>

      {/* 💡 Important Tips */}
      <section className="section-container">
        <h4 className="section-header">💡 Important Tips</h4>
        <div className="tips-grid">
          <div className="tip-item">
            <span className="tip-icon">📋</span>
            <div>
              <strong>Save Your Keys</strong>
              <p>Always archive your File ID and Key. They cannot be recovered if lost.</p>
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🔒</span>
            <div>
              <strong>Key Custody</strong>
              <p>Share keys only via secure, encrypted communication channels.</p>
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⚡</span>
            <div>
              <strong>MetaMask Needed</strong>
              <p>Ensure you have the extension active and some ETH for gas.</p>
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⏰</span>
            <div>
              <strong>8-Day Storage</strong>
              <p>Unmanaged files are purged every 8 days. Keep your keys safe!</p>
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-icon">📱</span>
            <div>
              <strong>Trial Run</strong>
              <p>Upload a small test file first to master the security workflow.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ready to get started? Footer CTA */}
      <footer className="cta-hero-footer">
        <p>Ready to get started? Connect your wallet above and try uploading a file!</p>
        <div className="cta-grid">
          <button
            className="cta-btn-premium primary"
            onClick={() => setActiveTab('upload')}
          >
            📤 Start Uploading
          </button>
          <button
            className="cta-btn-premium secondary"
            onClick={() => setActiveTab('verify')}
          >
            ✅ Try Verification
          </button>
        </div>
      </footer>
    </div>
  );
}

export default GettingStarted;