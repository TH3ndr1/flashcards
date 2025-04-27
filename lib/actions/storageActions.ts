'use server'

import { createActionClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_BUCKET = 'ai-uploads';
const EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Uploads a file to Supabase Storage using FormData from a Server Action
 * @param formData The FormData object containing the file, fileName, and fileType
 * @returns Object containing the file path and URL
 */
export async function uploadFileToStorage(formData: FormData) {
  const file = formData.get('file') as File | null;
  const fileName = formData.get('fileName') as string | null;
  const fileType = formData.get('fileType') as string | null;

  if (!file) {
    throw new Error('No file found in FormData');
  }
  if (!fileType) {
    throw new Error('No fileType found in FormData');
  }

  const supabase = createActionClient();
  
  // Get the authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('Authentication error in uploadFileToStorage', authError);
    throw new Error('You must be logged in to upload files');
  }
  
  // Convert File to ArrayBuffer/Buffer for upload
  const fileBuffer = await file.arrayBuffer();
  
  // Create a unique filename (use provided fileName if available)
  const fileExt = fileName ? `.${fileName.split('.').pop()}` : '';
  const storageFileName = fileName || `${uuidv4()}${fileExt}`;
  
  // Path format: userId/uniqueId-filename
  const path = `${user.id}/${storageFileName}`;
  
  console.log(`[StorageAction] Preparing upload. User ID: ${user.id}, Path: ${path}, Bucket: ${UPLOAD_BUCKET}, Type: ${fileType}`);
  
  // Upload the file buffer
  const { data, error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .upload(path, fileBuffer, { // Use fileBuffer here
      contentType: fileType,
      upsert: true,
    });
  
  if (error) {
    console.error('[StorageAction] Supabase Storage upload error:', error);
    console.error('Error uploading file to Supabase Storage', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
  
  console.log(`[StorageAction] Upload successful for path: ${path}`);
  
  // Get a URL for the file (temporary, signed URL)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .createSignedUrl(path, EXPIRY_SECONDS);
  
  if (signedUrlError) {
    console.error('[StorageAction] Error creating signed URL:', signedUrlError);
    console.error('Error creating signed URL', signedUrlError);
    throw new Error(`Failed to create file URL: ${signedUrlError.message}`);
  }
  
  console.log(`[StorageAction] Signed URL created for path: ${path}`);
  
  return {
    path,
    signedUrl: signedUrlData.signedUrl,
  };
}

/**
 * Retrieves a file from Supabase Storage
 * @param path The path of the file in Supabase Storage
 * @returns The file as an ArrayBuffer
 */
export async function getFileFromStorage(path: string) {
  const supabase = createActionClient();
  
  // Get the authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('Authentication error in getFileFromStorage', authError);
    throw new Error('You must be logged in to access files');
  }
  
  // Validate that the path belongs to the user
  if (!path.startsWith(`${user.id}/`)) {
    throw new Error('You do not have permission to access this file');
  }
  
  // Download the file
  const { data, error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .download(path);
  
  if (error) {
    console.error('Error downloading file from Supabase Storage', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
  
  return await data.arrayBuffer();
}

/**
 * Deletes a file from Supabase Storage
 * @param path The path of the file in Supabase Storage
 */
export async function deleteFileFromStorage(path: string) {
  const supabase = createActionClient();
  
  // Get the authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('Authentication error in deleteFileFromStorage', authError);
    throw new Error('You must be logged in to delete files');
  }
  
  // Validate that the path belongs to the user
  if (!path.startsWith(`${user.id}/`)) {
    throw new Error('You do not have permission to delete this file');
  }
  
  // Delete the file
  const { error } = await supabase.storage
    .from(UPLOAD_BUCKET)
    .remove([path]);
  
  if (error) {
    console.error('Error deleting file from Supabase Storage', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
  
  return { success: true };
} 