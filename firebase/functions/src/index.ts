import {setGlobalOptions} from "firebase-functions/v2/options";

// Global options for all v2 functions.
// 함수 공통 실행 옵션 region, maxInstances을 설정합니다.
setGlobalOptions({
  region: "asia-northeast3",
  maxInstances: 10,
});

// Callable entry points
export * from "./entry/callable/roomCallable";
export * from "./entry/callable/roleCallable";
export * from "./entry/callable/taskCallable";
export * from "./entry/callable/phaseCallable";
export * from "./entry/callable/newsCallable";
export * from "./entry/callable/resultCallable";

// Firestore triggers
export * from "./entry/firestore/roomTriggers";
export * from "./entry/firestore/taskTriggers";
export * from "./entry/firestore/phaseTriggers";
export * from "./entry/firestore/resultTriggers";

// Scheduled functions
export * from "./entry/schedule/nightlyPhaseScheduler";
export * from "./entry/schedule/daytimePhaseScheduler";
export * from "./entry/schedule/cleanupScheduler";