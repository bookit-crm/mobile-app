export class ValidatorsHelper {
  static userEmailReg = new RegExp(
    /^[^@\n]*[a-zA-Z][a-zA-Z0-9!#$%&'*+/=?^_`{|}~.,[\]-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  );

  static phoneRegExp = new RegExp(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/);

  static userPasswordReg = new RegExp(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/,
  );
}
