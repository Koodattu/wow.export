// M2 global sequences have one track shared by every character animation.
module.exports = function boneTrack(track, animationIndex, time, globalTimes) {
	if (!track) return null;
	const global = Number.isInteger(track.globalSeq) && track.globalSeq >= 0 && track.globalSeq < globalTimes.length;
	const index = global ? 0 : animationIndex;
	const timestamps = track.timestamps?.[index];
	const values = track.values?.[index];
	if (!timestamps?.length || !values?.length) return null;
	return { timestamps, values, time: global ? globalTimes[track.globalSeq] : time };
};
