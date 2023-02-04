// export interface DescriptorStat {
//   dev: Device,
//   ino: Inode,
//   type: DescriptorType,
//   nlink: Linkcount,
//   size: Filesize,
//   atim: Timestamp,
//   mtim: Timestamp,
//   ctim: Timestamp,
// }

export function flags (fd) {
  console.log(`FLAGS FOR ${fd}`);
}

export function setFlags(fd, flags) {
  console.log(`SET FLAGS ${fd} ${JSON.stringify(flags)}`);
}

export function close (fd) {
  console.log(`CLOSE: ${fd}`);
}

export function removeDirectoryAt (fd, path) {
  console.log(`RM DIR: ${fd} ${path}`);
}

export function unlinkFileAt (fd, path) {
  console.log(`UNLINK: ${fd} ${path}`);
}

export function appendViaStream (fd, offset) {
  console.log(`APPEND STREAM ${fd} ${offset}`);
}

export function writeViaStream (fd, offset) {
  console.log(`WRITE STREAM ${fd} ${offset}`);
}

export function readViaStream (fd, offset) {
  console.log(`READ STREAM ${fd} ${offset}`);
}

export function openAt (fd, atFlags, path, offset) {
  console.log(`OPEN AT ${fd}`);
}

export function stat (fd) {
  console.log(`STAT: ${fd}`);
}

export function todoType (fd) {
  console.log(`TODO TYPE: ${fd}`);
}

export function dropDirEntryStream(s) {
  console.log(`DROP DIR ENTRY STREAM`);
}

export function dropDescriptor(s) {
  console.log(`DROP DESCRIPTOR`);
}
