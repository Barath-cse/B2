import React from 'react';
import ReactDOM from 'react-dom';
import '../styles/ConfirmModal.css';

/**
 * Premium glassmorphic confirmation modal
 */
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Delete', cancelText = 'Cancel', type = 'info' }) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay">
      <div className={`modal-content glassmorphism ${type}`}>
        <div className="modal-header">
          <span className="modal-icon">
            {type === 'danger' ? '⚠️' : 'ℹ️'}
          </span>
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={`btn btn-confirm ${type}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
