import type { DefineProps } from 'vue'

declare module 'vue' {
    function defineProps<TypeProps>(): DefineProps<LooseRequired<TypeProps>, BooleanKey<TypeProps>> & {
        withOptions<Options extends InferOptions<LooseRequired<TypeProps>>>(
            options: Options,
        ): PropsWithOptions<LooseRequired<TypeProps>, Options, BooleanKey<TypeProps>>
    }
}

type LooseRequired<T> = {
    [P in keyof (T & Required<T>)]: T[P];
};
type BooleanKey<T, K extends keyof T = keyof T> = K extends any ? T[K] extends boolean | undefined ? T[K] extends never | undefined ? never : K : never : never;

type NativeType = null | undefined | number | string | boolean | symbol | Function;
type NotUndefined<T> = T extends undefined ? never : T;
type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;

type InferOptions<Props> = {
    [K in keyof Props]?: {
        default?: InferDefault<Props, Props[K]>;
        validator?(value: Exclude<Props[K], undefined>): boolean;
    };
};
type InferDefault<Props, T> = ((props: Props) => T & {}) | (T extends NativeType ? T : never);

type DefaultedKeys<Props, Options> = {
    [K in keyof Options]: Options[K] extends { default: unknown }
        ? K extends keyof Props ? K : never
        : never;
}[keyof Options];

type PropsWithOptions<
    Props,
    Options extends InferOptions<Props>,
    BKeys extends keyof Props,
> = Props extends unknown
    ? Readonly<
        {
            [K in keyof Props as K extends DefaultedKeys<Props, Options> ? never : K]: Props[K];
        } & {
            [K in keyof Props as K extends DefaultedKeys<Props, Options> ? K : never]-?:
                K extends keyof Options
                    ? Options[K] extends { default: infer Default }
                        ? Default extends undefined
                            ? IfAny<Default, NotUndefined<Props[K]>, Props[K]>
                            : NotUndefined<Props[K]>
                        : never
                    : never;
        } & {
            [K in BKeys]-?: K extends keyof Options
                ? Options[K] extends { default: infer Default }
                    ? Default extends undefined ? boolean | undefined : boolean
                    : boolean
                : boolean;
        }
    >
    : never;
