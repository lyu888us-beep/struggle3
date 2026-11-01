'use strict';
// Pure-JS header and dimensions check for Workers: no native Sharp dependency.
// This is not complete image decoding and cannot detect disguised ID images.
const {imageSize:sizeOf}=require('image-size');
module.exports=function validImageDimensions(buffer,mime){
 if(!Buffer.isBuffer(buffer)||buffer.length===0||buffer.length>4*1024*1024)return false;
 const result=sizeOf(buffer),expected={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime];
 return !!expected&&result.type===expected&&Number.isInteger(result.width)&&Number.isInteger(result.height)&&result.width>0&&result.height>0&&result.width*result.height<=24000000;
};
