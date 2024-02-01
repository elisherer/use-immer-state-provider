import { Draft } from "immer";
import { Context, createContext, useMemo } from "react";

import { useImmer } from "use-immer";

export interface UpdaterFunctions<T> {
  [arbitrary: string]: (draft: Draft<T>, ...args: any[]) => any;
}

type OmitDraftArg<F, T> = F extends (draft: Draft<T>, ...args: infer P) => any ? (...args: P) => any : never;

export type UpdatersApi<T, ActionsT extends UpdaterFunctions<T>> = {
  [prop in keyof ActionsT]: OmitDraftArg<ActionsT[prop], T>;
};

export type ImmerStateContextValue<T, ActionsT extends UpdaterFunctions<T>> = [T, UpdatersApi<T, ActionsT>];

export function createImmerStateContext<T, ActionsT extends UpdaterFunctions<T>>(
    initialState: T,
    actions: ActionsT,
): {
  context: Context<ImmerStateContextValue<T, ActionsT>>;
  initialValue: ImmerStateContextValue<T, ActionsT>;
} {
  const initialValue: ImmerStateContextValue<T, ActionsT> = [initialState, {} as UpdatersApi<T, typeof actions>];
  return { context: createContext(initialValue), initialValue };
}

export function useImmerStateProvider<T, ActionsT extends UpdaterFunctions<T>>(
    initialState: T | (() => T),
    actions: ActionsT,
    onError?: (e: Error) => any,
): [T, UpdatersApi<T, ActionsT>, ImmerStateContextValue<T, ActionsT>] {
  const [state, produceState] = useImmer<T>(initialState);

  const api = useMemo(() => {
    return (Object.keys(actions) as Array<keyof typeof actions>).reduce(
        (a, type) => {
          const orig = actions[type];
          a[type] = ((...payload: any[]) =>
              produceState(draft => {
                try {
                  actions[type](draft, ...payload);
                } catch (e: any) {
                  onError?.call(null, e);
                  console.error(e);
                }
              })) as OmitDraftArg<typeof orig, T>;
          return a;
        },
        {} as UpdatersApi<T, ActionsT>,
    );
  }, [produceState, actions, onError]);

  const value = useMemo(() => [state, api] as ImmerStateContextValue<T, ActionsT>, [state, api]);

  return [state, api, value];
}
