# Import packages
from PIL import Image
import glob
import os
import shutil

# Get all images in subdirectories
for file in glob.glob("./**/*.jpg", recursive=True):
	
	# Keep full resolution copy
	base_filename = os.path.basename(file).split(".")[0]
	shutil.copy(file, file.replace(base_filename, base_filename + "_full-res"))
	
	# Resize image
	img = Image.open(file)
	img = img.resize((880, 660), Image.ANTIALIAS)
	img.save(file, optimize=True, quality=95)
	