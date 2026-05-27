interface MediaDisplay {
  id: string;
  file_path?: string;
  file_type: string;
  file_size: number;
  mime_type: string;
  original_filename?: string;
  position_index: number;
}

interface ImageGridProps {
  images: MediaDisplay[];
}

export function ImageGrid({ images }: ImageGridProps) {
  if (!images || images.length === 0) return null;

  // Function to get image URL - prioritizes CloudFront/S3 if path exists, otherwise uses a placeholder
  const getImageUrl = (image: MediaDisplay) => {
    if (image.file_path) {
      // If it's a full URL already (unlikely with our setup but safe)
      if (image.file_path.startsWith('http')) return image.file_path;
      
      // Use the CloudFront/API URL. For local dev, we proxy /media to the S3 bucket or handle it via backend.
      // Based on terraform, media is at /media/* on the same domain as the frontend
      return `/${image.file_path}`;
    }
    return '';
  };

  const gridCols = images.length === 1 ? 'grid-cols-1' : 
                   images.length === 2 ? 'grid-cols-2' : 
                   images.length === 3 ? 'grid-cols-2' : 'grid-cols-2';

  return (
    <div className={`grid ${gridCols} gap-2 mb-2 w-full max-w-[400px] ml-auto`}>
      {images.map((image, index) => (
        <div 
          key={image.id} 
          className={`
            relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900
            ${images.length === 3 && index === 0 ? 'col-span-2' : ''}
            aspect-video
          `}
        >
          <img
            src={getImageUrl(image)}
            alt={image.original_filename || 'Attachment'}
            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(getImageUrl(image), '_blank')}
            onError={(e) => {
              // Fallback for broken images
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x225?text=Image+Not+Found';
            }}
          />
        </div>
      ))}
    </div>
  );
}
