import React, { useState, useEffect, useCallback, Suspense } from 'react';
import WalletConnect from './components/WalletConnect';
import './App.css';

const GettingStarted = React.lazy(() => import('./components/GettingStarted'));
const FileUpload = React.lazy(() => import('./components/FileUpload'));
const FileVerify = React.lazy(() => import('./components/FileVerify'));
const AccessControl = React.lazy(() => import('./components/AccessControl'));
const MyFiles = React.lazy(() => import('./components/MyFiles'));


// Loading fallback component
const LoadingFallback = () => (
  <div className="loading-fallback">
    <p>⏳ Loading Secured Portal...</p>
  </div>
);

// If you don't want to interact with the blockchain (no gas required)
// set this flag to false. The app will behave like the older version.
const BLOCKCHAIN_ENABLED = true;

// Contract configuration – only used when BLOCKCHAIN_ENABLED is true
const contractAddress = "0xBCBf15C2899D62d6701A8294d88751E98512dec0";

const CONTRACT_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "fileId", "type": "string"},
            {"internalType": "string", "name": "_hash", "type": "string"}
        ],
        "name": "uploadFile",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "fileId", "type": "string"},
            {"internalType": "string", "name": "_hash", "type": "string"}
        ],
        "name": "verifyFile",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "fileId", "type": "string"},
            {"internalType": "address", "name": "user", "type": "address"}
        ],
        "name": "grantAccess",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "fileId", "type": "string"},
            {"internalType": "address", "name": "user", "type": "address"}
        ],
        "name": "revokeAccess",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "fileId", "type": "string"},
            {"internalType": "address", "name": "user", "type": "address"}
        ],
        "name": "hasAccess",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "fileId", "type": "string"}
        ],
        "name": "getFileDetails",
        "outputs": [
            {"internalType": "string", "name": "", "type": "string"},
            {"internalType": "address", "name": "", "type": "address"}
        ],
        "stateMutability": "view",
        "type": "function"
    },

];

function App() {
  // Restore tab from session storage if available (to avoid redirect on page refresh)
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const lastTab = sessionStorage.getItem('lastTab');
      if (lastTab) return lastTab;
    } catch {}
    return 'getting-started'; // Start with onboarding
  });

  const [selectedFileId, setSelectedFileId] = useState('');


  // when blockchain is disabled we don't care about wallet or address
  // initialize from storage if available; fallback to offline/empty
  const [userAddress, setUserAddress] = useState(() => {
    try {
      const stored = localStorage.getItem('userAddress');
      if (stored) return stored;
    } catch {}
    return BLOCKCHAIN_ENABLED ? '' : 'offline';
  });
  
  // Restore connection status from localStorage (persist across page refresh)
  const [connected, setConnected] = useState(() => {
    if (!BLOCKCHAIN_ENABLED) return true;
    try {
      const wasConnected = localStorage.getItem('walletConnected');
      return wasConnected === 'true';
    } catch {}
    return false;
  });
  
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);

  // used to signal other components (e.g. AccessControl) that files may need reloading
  const [filesRefreshToken, setFilesRefreshToken] = useState(0);
  const triggerFilesRefresh = () => setFilesRefreshToken((t) => t + 1);

  const handleWalletConnect = useCallback(async (address) => {
    // only used when blockchain enabled
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask provider not found');
      }

      const ethers = await import('ethers');
      const ethersProvider = new ethers.BrowserProvider(window.ethereum);
      
      // Ensure we can get the signer (this might fail if extension is locked)
      let signer;
      try {
        signer = await ethersProvider.getSigner();
      } catch (signerErr) {
        console.warn('Could not get signer, extension might be locked:', signerErr);
        // If we can't get signer, we can't initialize contract with signer
        // but we might still want to set the provider
        setProvider(ethersProvider);
        return; 
      }

      const contractInstance = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);
      
      setProvider(ethersProvider);
      setContract(contractInstance);
      setUserAddress(address);
      setConnected(true);
      setActiveTab('getting-started');

      try {
        localStorage.setItem('userAddress', address);
        localStorage.setItem('walletConnected', 'true');
      } catch {}
    } catch (err) {
      console.error('Error setting up contract:', err);
      alert('Failed to initialize contract. Please check your connection.');
    }
  }, [setActiveTab]); // userAddress removed as it's not used in logic, added setActiveTab

  const handleDisconnect = useCallback(() => {
    setConnected(false);
    // keep userAddress so that users can still manage files offline and view their address
    // but clear blockchain-connected state
    setProvider(null);
    setContract(null);
    
    try {
      localStorage.setItem('walletConnected', 'false');
    } catch {}
  }, []);

  // Re-establish connection automatically on refresh if previously connected
  useEffect(() => {
    const reConnect = async () => {
      // Small delay to allow MetaMask extension to inject 'window.ethereum'
      await new Promise(r => setTimeout(r, 800));

      if (BLOCKCHAIN_ENABLED && connected && userAddress && userAddress !== 'offline' && !provider) {
        if (window.ethereum) {
          try {
            // Check if still actually connected to MetaMask
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0 && accounts[0].toLowerCase() === userAddress.toLowerCase()) {
              await handleWalletConnect(accounts[0]);
            } else {
              // Address mismatch or disconnected in extension
              setConnected(false);
            }
          } catch (err) {
            console.error('Auto-reconnect failed:', err);
          }
        }
      }
    };
    reConnect();
  }, [connected, userAddress, provider, handleWalletConnect]);

  const handleManageFile = (fileId) => {
    setSelectedFileId(fileId);
    setActiveTab('access');
    sessionStorage.setItem('lastTab', 'access');
  };


  return (
    <div className="app-container">
      {/* Animated Background Layers */}
      <div className="bg-animation"></div>
      <div className="bg-glow"></div>

      {BLOCKCHAIN_ENABLED && !connected ? (
        <div className="landing-page" key="landing">
          <header className="landing-header-ribbon">
            <div className="landing-logo-box">
              <span className="landing-logo-icon">🔐</span>
              <h1 className="landing-logo-text">BlockSecure</h1>
            </div>
            <p className="landing-mission">Blockchain-Based Secure File Integrity & Access Control</p>
          </header>
          
          <main className="landing-main">
            <WalletConnect onConnect={handleWalletConnect} />
            {/* <div className="scroll-indicator" onClick={() => {
              document.querySelector('.landing-page').scrollTo({
                top: 500,
                behavior: 'smooth'
              });
            }}>
              <span className="scroll-arrow">↓</span>
              <span className="scroll-text">Explore Requirements</span>
            </div> */}
          </main>
          
          <footer className="landing-footer-ribbon">
            <p>© BlockSecure. Decentralized File Integrity System.</p>
          </footer>
        </div>
      ) : (
        <div className="dashboard-layout" key="dashboard">
          {/* Glass Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-brand">
              <span className="brand-logo">🔐</span>
              <span className="brand-name">BlockSecure</span>
            </div>

            <nav className="sidebar-nav">
              <button
                className={`nav-item ${activeTab === 'getting-started' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('getting-started');
                  sessionStorage.setItem('lastTab', 'getting-started');
                }}
              >
                <span className="nav-icon">🚀</span>
                <span className="nav-label">Getting Started</span>
              </button>

              <div className="nav-separator">Manage</div>

              <button
                className={`nav-item ${activeTab === 'my-files' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('my-files');
                  sessionStorage.setItem('lastTab', 'my-files');
                }}
              >
                <span className="nav-icon">📂</span>
                <span className="nav-label">File Dashboard</span>
              </button>

              <button
                className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('upload');
                  sessionStorage.setItem('lastTab', 'upload');
                }}
              >
                <span className="nav-icon">📤</span>
                <span className="nav-label">Secure Upload</span>
              </button>

              <button
                className={`nav-item ${activeTab === 'verify' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('verify');
                  sessionStorage.setItem('lastTab', 'verify');
                }}
              >
                <span className="nav-icon">✅</span>
                <span className="nav-label">Verify Integrity</span>
              </button>

              <button
                className={`nav-item ${activeTab === 'access' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('access');
                  sessionStorage.setItem('lastTab', 'access');
                }}
              >
                <span className="nav-icon">🔐</span>
                <span className="nav-label">Access Control</span>
              </button>
            </nav>

            <div className="sidebar-footer">
              <div className="user-mini-card">
                <div className="user-avatar">
                  {userAddress ? userAddress.substring(2, 4).toUpperCase() : '??'}
                </div>
                <div className="user-details">
                  <span className="user-label">Connected Wallet</span>
                  <span className="user-addr">{userAddress ? `${userAddress.substring(0, 6)}...${userAddress.substring(38)}` : 'Disconnected'}</span>
                </div>
              </div>
              <button className="logout-btn" onClick={handleDisconnect} title="Disconnect Wallet">
                🚪
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="main-content">
            <header className="content-header">
              <div className="header-title">
                <h2>{
                  activeTab === 'my-files' ? 'File Dashboard' :
                  activeTab === 'getting-started' ? 'Getting Started' :
                  activeTab === 'upload' ? 'Secure File Upload' :
                  activeTab === 'verify' ? 'Integrity Verification' :
                  activeTab === 'access' ? 'Access Management' : 'Dashboard'
                }</h2>
                <p>Secure, decentralized file protection powered by Ethereum.</p>
              </div>
              <div className="header-actions">
                <span className="network-badge">Mainnet Node</span>
                <span className="status-dot"></span>
              </div>
            </header>

            <div className="content-body">
              <Suspense fallback={<LoadingFallback />}>
                <div className="tab-wrapper" key={activeTab}>
                  {activeTab === 'my-files' && (
                    <MyFiles 
                      userAddress={userAddress} 
                      onSelectFile={handleManageFile} 
                    />
                  )}
                  {activeTab === 'getting-started' && (
                    <GettingStarted setActiveTab={(tab) => {
                      setActiveTab(tab);
                      sessionStorage.setItem('lastTab', tab);
                    }} />
                  )}

                  {activeTab === 'upload' && (
                    <FileUpload userAddress={userAddress} provider={provider} contract={contract} onUploadSuccess={triggerFilesRefresh} />
                  )}
                  {activeTab === 'verify' && (
                    <FileVerify userAddress={userAddress} contract={contract} />
                  )}
                  {activeTab === 'access' && (
                    <AccessControl 
                      userAddress={userAddress}
                      provider={provider}
                      contract={contract}
                      abi={CONTRACT_ABI}
                      initialFileId={selectedFileId}
                      refreshToken={filesRefreshToken}
                    />
                  )}
                </div>
              </Suspense>
            </div>
          </main>
        </div>
      )}
    </div>
  );

}

export default App;
