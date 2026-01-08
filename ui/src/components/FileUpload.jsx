import { useEffect, useState } from 'react';
import Uppy from '@uppy/core';
import XHRUpload from '@uppy/xhr-upload';
import Dashboard from '@uppy/react/dashboard';

// Import Uppy styles using package exports
import '@uppy/core/css/style.css';
import '@uppy/dashboard/css/style.css';

export default function FileUpload({ collections, selectedCollectionId, onCollectionChange, onUploadSuccess }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  const [uppy] = useState(() => {
    const u = new Uppy({
      restrictions: {
        allowedFileTypes: ['image/*', 'application/zip', 'application/x-zip-compressed', 'audio/mpeg', 'audio/mp3', 'video/mp4'],
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

  // Update XHR Upload meta when collection, title, or description changes
  useEffect(() => {
    const meta = {};
    if (selectedCollectionId) {
      meta.collectionId = selectedCollectionId;
    }
    if (title) {
      meta.title = title;
    }
    if (description) {
      meta.description = description;
    }
    uppy.setMeta(meta);
  }, [selectedCollectionId, title, description, uppy]);

  useEffect(() => {
    const handleComplete = (result) => {
      console.log('Upload complete:', result.successful);
      if (result.successful && result.successful.length > 0) {
        const response = result.successful[0].response.body;
        if (onUploadSuccess) {
          onUploadSuccess(response);
        }
        // Clear title and description after successful upload
        setTitle('');
        setDescription('');
        // Clear Uppy metadata
        uppy.setMeta({});
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
        <div className="field">
          <label className="label">Upload to Collection</label>
          <div className="control">
            <div className="select form-field-max">
              <select
                value={selectedCollectionId || ''}
                onChange={(e) => onCollectionChange(parseInt(e.target.value))}
              >
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
      
      <div className="field">
        <label className="label">Title (optional)</label>
        <div className="control">
          <input
            className="input form-field-max"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Custom title for this file"
          />
        </div>
      </div>
      
      <div className="field">
        <label className="label">Description (optional)</label>
        <div className="control">
          <textarea
            className="textarea form-field-max"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description"
            rows={3}
          />
        </div>
      </div>
      
      <Dashboard
        uppy={uppy}
        proudlyDisplayPoweredByUppy={false}
        height={360}
        note="Drop an image, audio, video, or zip file here or click to browse"
      />
    </div>
  );
}
