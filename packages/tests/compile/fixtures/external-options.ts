export const options = {
    foo: {
        default: 'bar',
        validator: (value: string) => value.length > 0
    }
}