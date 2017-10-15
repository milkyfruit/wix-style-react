import React, {Component} from 'react';
import PropTypes from 'prop-types';
import reactElementToJSXString from 'react-element-to-jsx-string';

import componentParser from '../AutoDocs/parser';

import {
  Wrapper,
  Options,
  Option,
  Preview,
  Code,
  Toggle,
  Input,
  List
} from './FormComponents';

const stripQuotes = string => {
  const quoted = string.match(/^['"](.*?)['"]$/);
  return quoted ? quoted[1] : string;
};

/**
  * Create a playground for some component, which is suitable for storybook. Given raw `source`, component reference
  * and, optionally, `componentProps`,`AutoExample` will render:
  *
  * * list of all available props with toggles or input fields to control them (with `defaultProps` values applied)
  * * live preview of `component`
  * * live code example
  *
  *
  * ### Example:
  *
  * ```js
  * import AutoExample from 'stories/utils/Components/AutoExample';
  * import component from 'wix-style-react/MyComponent';
  * import source from '!raw-loader!wix-style-react/MyComponent/MyComponent'; // raw string, not something like `export {default} from './MyComponent.js';`
  *
  * <AutoExample
  *   source={source}
  *   component={component}
  *   componentProps={{
  *     value: 'some default value',
  *     onClick: () => console.log('some handler')
  *   }}
  * />
  * ```
  */
export default class extends Component {
  static displayName = 'AutoExample';

  static propTypes = {
    /**
      * raw string of component source.
      *
      * uses `AutoDocs` under the hood. Read doc covering `AutoDocs` to learn more.
      *
      * Easiest is to `import source from '!raw-loader!my-component'`.
      *
      * Ensure there is only one component exported per file and the syntax is correct.
      *
      * Supported are both, functional and class components.
      * class components must have `render()` method. If you `extend` class and don't have `render()`, reconsider such
      * approach
      *
      */
    source: PropTypes.string.isRequired,

    /**
      * reference to react component
      *
      * this is the usual `import component from 'my-component'`
      */
    component: PropTypes.func.isRequired,

    /**
      * control default props and their state of component in preview.
      *
      * can be either `object` or `function`:
      *
      * * `object` - simple javascript object which reflects `component` properties.
      * * `function` - `(setProps, getProps) => props`
      *      receives `setProps` setter and `getProps` getter. can be used to persist props state and react to event
      *      handlers and must return an object which will be used as new props. For example:
      *
      * ```js
      * <AutoExample
      *   component={ToggleSwitch}
      *   componentProps={(setProps, getProps) => ({
      *     checked: false,
      *     onChange: () => setProps({ checked: !getProps().checked })
      *   })}
      * ```
      */
    componentProps: PropTypes.oneOfType([PropTypes.func, PropTypes.object])
  }

  static defaultProps = {
    source: '',
    component: () => null,
    componentProps: {}
  }

  constructor(props) {
    super(props);

    this.parsedComponent = componentParser(this.props.source);

    this.state = {
      propsState: {
        ...(this.props.component.defaultProps || {}),
        ...(this.prepareComponentProps(this.props.componentProps))
      }
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      propsState: {...this.state.propsState, ...this.prepareComponentProps(nextProps.componentProps)}
    });
  }

  prepareComponentProps = props =>
    typeof props === 'function' ?
      props(
        // setProps
        componentProps =>
          this.setState({
            propsState: {...this.state.propsState, ...componentProps}
          }),

        // getProps
        () => this.state.propsState || {}
      ) :
      props;


  mapControllableProps = fn =>
    Object
      .keys(this.parsedComponent.props)
      .filter(key => Object.keys(this.controllableComponentGetters).includes(this.parsedComponent.props[key].type.name))
      .map(key => fn(this.parsedComponent.props[key], key));

  setProp = (key, value) =>
    this.setState({propsState: {...this.state.propsState, [key]: value}});


  controllableComponentGetters = {
    string: ({dataHook}) => <Input dataHook={dataHook}/>,
    bool: ({dataHook}) => <Toggle dataHook={dataHook}/>,
    enum: ({dataHook, type}) =>
      <List
        dataHook={dataHook}
        values={type.value.map(({value}) => stripQuotes(value))}
        />
  }

  getPropControlComponent = (propKey, type) => {
    const types = {
      bool: 'toggle',
      string: 'input',
      enum: 'radioGroup'
    };

    const dataHook = `storybook-${this.parsedComponent.displayName}-${propKey}-${types[type.name] || 'input'}`;
    return (this.controllableComponentGetters[type.name] || (() => null))({propKey, type, dataHook});
  }

  componentToString = component =>
    reactElementToJSXString(component, {showDefaultProps: false, showFunctions: true})

  render() {
    const component = this.props.component;
    const componentPropsState = this.state.propsState;

    return (
      <Wrapper dataHook="auto-example">
        <Options>
          { this.mapControllableProps((prop, key) =>
            <Option
              {...{
                key,
                label: key,
                value: componentPropsState[key],
                onChange: value => this.setProp(key, value),
                children: this.getPropControlComponent(key, prop.type)
              }}
              />
          ) }
        </Options>

        <Preview>
          {React.createElement(component, componentPropsState)}
        </Preview>

        <Code source={this.componentToString(React.createElement(component, componentPropsState))}/>
      </Wrapper>
    );
  }
}
