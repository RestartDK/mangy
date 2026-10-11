import { Cause, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";

export const asyncResultError = <A, E>(
  result: AsyncResult.AsyncResult<A, E>
): unknown =>
  AsyncResult.isFailure(result) ? Cause.squash(result.cause) : undefined;

export const asyncResultLoading = <A, E>(
  result: AsyncResult.AsyncResult<A, E>
): boolean => AsyncResult.isInitial(result);

export const asyncResultValue = <A, E>(
  result: AsyncResult.AsyncResult<A, E>
): A | undefined => Option.getOrUndefined(AsyncResult.value(result));
