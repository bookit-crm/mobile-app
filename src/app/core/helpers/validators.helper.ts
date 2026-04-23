export class ValidatorsHelper {
  static userEmailReg = new RegExp(
    /^[^@\n]*[a-zA-Z][a-zA-Z0-9!#$%&'*+/=?^_`{|}~.,[\]-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  );
}
