import { useEffect, useState } from 'react';
import Uppy from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';
import Dashboard from '@uppy/react/dashboard';

// Import Uppy styles using package exports
import '@uppy/core/css/style.css';
import '@uppy/dashboard/css/style.css';

export default function ImageUpload({ collections, selectedCollectionId, onCollectionChange, onUploadSuccess }) {
  const [uppy] = useState(() => {
    const u = new Uppy({
      restrictions: {
        allowedFileTypes: ['image/*', 'application/zip', 'application/x-zip-compressed'],
        maxNumberOfFiles: 1
      },
      autoProceed: false
    });

    u.use(XHRUpload, {
      endpoint: '/api/media/upload',
      fieldName: 'file',
      formData: true,
      withCredentials: true
    });

    return u;
  });

  // Update XHR Upload meta when collection changes
  useEffect(() => {
    if (selectedCollectionId) {
      uppy.setMeta({ collectionId: selectedCollectionId });
    }
  }, [selectedCollectionId, uppy]);

  useEffect(() => {
    const handleComplete = (result) => {
      console.log('Upload complete:', result.successful);
      if (result.successful && result.successful.length > 0) {
        const response = result.successful[0].response.body;
        if (onUploadSuccess) {
          onUploadSuccess(response);
        }
      }
    };

    const handleError = (file, error) => {
      console.error('Upload error:', file?.name, error);
    };

    uppy.on('complete', handleComplete);
    uppy.on('upload-error', handleError);

    return () => {
      uppy.off('complete', handleComplete);
      uppy.off('upload-error', handleError);
    };
  }, [uppy, onUploadSuccess]);

  useEffect(() => {
    return () => {
      uppy.cancelAll();
    };
  }, [uppy]);

  return (
    <div>
      {collections && collections.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem',
            fontSize: '14px',
            fontWeight: '500',
            color: '#333'
          }}>
            Upload to Collection
          </label>
          <select
            value={selectedCollectionId || ''}
            onChange={(e) => onCollectionChange(parseInt(e.target.value))}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '8px 12px',
              fontSize: '14px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          >
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <Dashboard
        uppy={uppy}
        proudlyDisplayPoweredByUppy={false}
        height={360}
        note="Drop an image or zip file here or click to browse"
      />
    </div>
  );
}
