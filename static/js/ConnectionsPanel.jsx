const {
  Dropdown,
  LoadingMessage,
  LoginPrompt,
  LanguageToggleButton,
  ReaderNavigationMenuCloseButton,
  AddToSourceSheetBox,
  Note,
}                = require('./Misc');
const React      = require('react');
const PropTypes  = require('prop-types');
const ReactDOM   = require('react-dom');
const Sefaria    = require('./sefaria');
const $          = require('./sefariaJquery');
const TextRange  = require('./TextRange');
const classNames = require('classnames');
import Component from 'react-class';

class ConnectionsPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {flashMessage: null};
  }
  componentDidMount() {
    this._isMounted = true;
    this.loadData();
  }
  componentWillUnmount() {
    this._isMounted = false;
  }
  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.srefs.compare(this.props.srefs)) {
      this.loadData();
    }
    // Turn on the lexicon when receiving new words if they are less than 3
    // and don't span refs.
    if (!prevProps.selectedWords && this.props.selectedWords &&
        this.props.selectedWords.split(" ").length < 3 &&
        this.props.srefs.length == 1) {
      this.props.setConnectionsMode("Lexicon");
    }
    // Go back to main sidebar when words are unselected
    if (prevProps.selectedWords && prevProps.mode === "Lexicon" && !this.props.selectedWords) {
      this.props.setConnectionsMode("Resources");
    }
  }
  sectionRef() {
    return Sefaria.sectionRef(Sefaria.humanRef(this.props.srefs)) || this.props.srefs;
  }
  loadData() {
    var ref = this.sectionRef();
    if (!Sefaria.related(ref)) {
      Sefaria.related(ref, function() {
        if (this._isMounted) {
          this.forceUpdate();
        }
      }.bind(this));
    }
  }
  reloadData() {
    Sefaria.clearLinks();
    this.loadData();
  }
  flashMessage(msg) {
    this.setState({flashMessage: msg});
    setTimeout(function() {
      this.setState({flashMessage: null});
    }.bind(this), 3000);
  }
  render() {
    var content = null;
    var loaded = Sefaria.linksLoaded(this.sectionRef());
    if (!loaded) {
      content = <LoadingMessage />;
    } else if (this.props.mode == "Resources") {
      var sheetsCount = Sefaria.sheets.sheetsTotalCount(this.props.srefs);
      var notesCount  = Sefaria.notesTotalCount(this.props.srefs);
      content = (<div>
                  { this.state.flashMessage ?
                    <div className="flashMessage sans">{this.state.flashMessage}</div>
                    : null }
                  <ConnectionsSummary
                    srefs={this.props.srefs}
                    showBooks={false}
                    multiPanel={this.props.multiPanel}
                    filter={this.props.filter}
                    contentLang={this.props.contentLang}
                    setFilter={this.props.setFilter}
                    setConnectionsMode={this.props.setConnectionsMode}
                    setConnectionsCategory={this.props.setConnectionsCategory} />
                  <ResourcesList
                    multiPanel={this.props.multiPanel}
                    setConnectionsMode={this.props.setConnectionsMode}
                    openComparePanel={this.props.openComparePanel}
                    sheetsCount={sheetsCount}
                    notesCount={notesCount} />
                  </div>);

    } else if (this.props.mode === "ConnectionsList") {
      content = (<ConnectionsSummary
                    srefs={this.props.srefs}
                    category={this.props.connectionsCategory}
                    showBooks={true}
                    multiPanel={this.props.multiPanel}
                    contentLang={this.props.contentLang}
                    filter={this.props.filter}
                    setFilter={this.props.setFilter}
                    setConnectionsMode={this.props.setConnectionsMode}
                    setConnectionsCategory={this.props.setConnectionsCategory} />);

    } else if (this.props.mode === "TextList") {
      content = (<TextList
                    srefs={this.props.srefs}
                    filter={this.props.filter}
                    recentFilters={this.props.recentFilters}
                    fullPanel={this.props.fullPanel}
                    multiPanel={this.props.multiPanel}
                    contentLang={this.props.conteLang}
                    setFilter={this.props.setFilter}
                    setConnectionsMode={this.props.setConnectionsMode}
                    onTextClick={this.props.onTextClick}
                    onCitationClick={this.props.onCitationClick}
                    onNavigationClick={this.props.onNavigationClick}
                    onCompareClick={this.props.onCompareClick}
                    onOpenConnectionsClick={this.props.onOpenConnectionsClick}
                    openNav={this.props.openNav}
                    openDisplaySettings={this.props.openDisplaySettings}
                    closePanel={this.props.closePanel}
                    selectedWords={this.props.selectedWords}/>);

    } else if (this.props.mode === "Sheets") {
      content = (<div>
                  <AddToSourceSheetBox
                    srefs={this.props.srefs}
                    fullPanel={this.props.fullPanel}
                    setConnectionsMode={this.props.setConnectionsMode}
                    version={this.props.version}
                    versionLanguage={this.props.versionLanguage}
                    addToSourceSheet={this.props.addToSourceSheet} />
                  { Sefaria._uid ?
                  <a href="/sheets/private" className="allSheetsLink button transparent bordered fillWidth squareBorder">
                    <span className="int-en">Go to My Sheets</span>
                    <span className="int-he">דפי המקורות שלי</span>
                  </a>
                  : null }
                  <MySheetsList
                    srefs={this.props.srefs}
                    fullPanel={this.props.fullPanel} />
                  <PublicSheetsList
                    srefs={this.props.srefs}
                    fullPanel={this.props.fullPanel} />
                </div>);

    } else if (this.props.mode === "Notes") {
      content = (<div>
                  <AddNoteBox
                    srefs={this.props.srefs}
                    fullPanel={this.props.fullPanel}
                    closePanel={this.props.closePanel}
                    onSave={() => this.props.setConnectionsMode("Notes")}
                    onCancel={() => this.props.setConnectionsMode("Notes")} />
                  { Sefaria._uid ?
                  <a href="/my/notes" className="allNotesLink button transparent bordered fillWidth squareBorder">
                    <span className="int-en">Go to My Notes</span>
                    <span className="int-he">הרשומות שלי</span>
                  </a>
                  : null }
                  <MyNotes
                    srefs={this.props.srefs}
                    editNote={this.props.editNote} />
                </div>);

    } else if (this.props.mode === "Lexicon") {
      content = (<LexiconBox
                    selectedWords={this.props.selectedWords}
                    oref={Sefaria.ref(this.props.srefs[0])} />);

    } else if (this.props.mode === "Tools") {
      content = (<ToolsList
                    srefs={this.props.srefs}
                    mode={this.props.mode}
                    filter={this.props.filter}
                    recentFilters={this.props.recentFilters}
                    fullPanel={this.props.fullPanel}
                    multiPanel={this.props.multiPanel}
                    canEditText={this.props.canEditText}
                    setFilter={this.props.setFilter}
                    setConnectionsMode={this.props.setConnectionsMode}
                    onTextClick={this.props.onTextClick}
                    onCitationClick={this.props.onCitationClick}
                    onNavigationClick={this.props.onNavigationClick}
                    onCompareClick={this.props.onCompareClick}
                    onOpenConnectionsClick={this.props.onOpenConnectionsClick}
                    openNav={this.props.openNav}
                    openDisplaySettings={this.props.openDisplaySettings}
                    openComparePanel={this.props.openComparePanel}
                    closePanel={this.props.closePanel}
                    version={this.props.version}
                    versionLanguage={this.props.versionLanguage} />);

    } else if (this.props.mode === "Share") {
      content = (<ShareBox
                    url={window.location.href}
                    fullPanel={this.props.fullPanel}
                    closePanel={this.props.closePanel}
                    setConnectionsMode={this.props.setConnectionsMode} />);

    } else if (this.props.mode === "Edit Note") {
      content = (<AddNoteBox
                    srefs={this.props.srefs}
                    noteId={this.props.noteBeingEdited._id}
                    noteText={this.props.noteBeingEdited.text}
                    noteTitle={this.props.noteBeingEdited.title}
                    noteIsPublic={this.props.noteBeingEdited.isPublic}
                    fullPanel={this.props.fullPanel}
                    closePanel={this.props.closePanel}
                    onSave={() => this.props.setConnectionsMode("Notes")}
                    onCancel={() => this.props.setConnectionsMode("Notes")}
                    onDelete={() => this.props.setConnectionsMode("Notes")} />);

    } else if (this.props.mode === "Add Connection") {
      var onSave = function() {
        this.reloadData();
        this.props.setConnectionsMode("Resources");
        this.flashMessage("Success! You've created a new connection.");
      }.bind(this);
      content = <AddConnectionBox
                    srefs={this.props.allOpenRefs}
                    openComparePanel={this.props.openComparePanel}
                    onSave={onSave}
                    onCancel={() => this.props.setConnectionsMode("Resources")} />

    } else if (this.props.mode === "Login") {
      content = (<LoginPrompt fullPanel={this.props.fullPanel} />);
    }

    var classes = classNames({connectionsPanel: 1, textList: 1, fullPanel: this.props.fullPanel, singlePanel: !this.props.fullPanel});
    return (
      <div className={classes} key={this.props.mode}>
        { this.props.fullPanel ? null :
          <ConnectionsPanelHeader
            connectionsMode={this.props.mode}
            previousCategory={this.props.connectionsCategory}
            setConnectionsMode={this.props.setConnectionsMode}
            setConnectionsCategory={this.props.setConnectionsCategory}
            multiPanel={this.props.multiPanel}
            filter={this.props.filter}
            recentFilters={this.props.recentFilters}
            baseRefs={this.props.srefs}
            setFilter={this.props.setFilter}
            closePanel={this.props.closePanel}
            toggleLanguage={this.props.toggleLanguage}
            interfaceLang={this.props.interfaceLang}/> }
        <div className="texts">
          <div className="contentInner">{content}</div>
        </div>
      </div>);

  }
}

ConnectionsPanel.propTypes = {
  srefs:                   PropTypes.array.isRequired,  // an array of ref strings
  filter:                  PropTypes.array.isRequired,
  recentFilters:           PropTypes.array.isRequired,
  mode:                    PropTypes.string.isRequired, // "Resources", "ConnectionsList", "TextList" etc., called `connectionsMode` above
  connectionsCategory:     PropTypes.string,            // with mode:"ConnectionsList", which category of connections to show
  setFilter:               PropTypes.func.isRequired,
  setConnectionsMode:      PropTypes.func.isRequired,
  setConnectionsCategory:  PropTypes.func.isRequired,
  editNote:                PropTypes.func.isRequired,
  openComparePanel:        PropTypes.func.isRequired,
  addToSourceSheet:        PropTypes.func.isRequired,
  version:                 PropTypes.string,
  versionLanguage:         PropTypes.string,
  noteBeingEdited:         PropTypes.object,
  fullPanel:               PropTypes.bool,
  multiPanel:              PropTypes.bool,
  canEditText:             PropTypes.bool,
  onTextClick:             PropTypes.func,
  onCitationClick:         PropTypes.func,
  onNavigationClick:       PropTypes.func,
  onCompareClick:          PropTypes.func,
  onOpenConnectionsClick:  PropTypes.func,
  openNav:                 PropTypes.func,
  openDisplaySettings:     PropTypes.func,
  closePanel:              PropTypes.func,
  toggleLanguage:          PropTypes.func,
  selectedWords:           PropTypes.string,
  interfaceLang:           PropTypes.string,
  contentLang:             PropTypes.string,

};


class ConnectionsPanelHeader extends Component {
  componentDidMount() {
    this.setMarginForScrollbar();
  }
  setMarginForScrollbar() {
    // Scrollbars take up spacing, causing the centering of ConnectsionPanel to be slightly off center
    // compared to the header. This functions sets appropriate margin to compensate.
    var width      = Sefaria.util.getScrollbarWidth();
    var $container = $(ReactDOM.findDOMNode(this));
    if (this.props.interfaceLang == "hebrew") {
      $container.css({marginRight: 0, marginLeft: width});
    } else {
      $container.css({marginRight: width, marginLeft: 0});
    }
  }
  render() {
    if (this.props.connectionsMode == "Resources") {
      // Top Level Menu
      var title = <div className="connectionsHeaderTitle">
                    {this.props.interfaceLang == "english" ? <div className="int-en">Resources</div> : null }
                    {this.props.interfaceLang == "hebrew" ? <div className="int-he">קישורים וכלים</div> : null }
                  </div>;
    } else if (this.props.previousCategory && this.props.connectionsMode == "TextList") {
      // In a text list, back to Previous Categoy

      var url = Sefaria.util.replaceUrlParam("with", this.props.previousCategory);
      var onClick = function(e) {
        this.props.setConnectionsCategory(this.props.previousCategory);
        e.preventDefault();
      }.bind(this);
      var title = <a href={url} className="connectionsHeaderTitle active" onClick={onClick}>
                    {this.props.interfaceLang == "english" ? <div className="int-en"><i className="fa fa-chevron-left"></i>{this.props.multiPanel ? this.props.previousCategory : null }</div> : null }
                    {this.props.interfaceLang == "hebrew" ? <div className="int-he"><i className="fa fa-chevron-right"></i>{this.props.multiPanel ? Sefaria.hebrewTerm(this.props.previousCategory) : null }</div> : null }
                  </a>;

    } else {
      // Anywhere else, back to Top Level
      var url = Sefaria.util.replaceUrlParam("with", "all");
      var onClick = function(e) {
        e.preventDefault();
        this.props.setConnectionsMode("Resources");
      }.bind(this);
      var title = <a href={url} className="connectionsHeaderTitle active" onClick={onClick}>
                    {this.props.interfaceLang == "english" ? <div className="int-en"><i className="fa fa-chevron-left"></i>Resources</div> : null }
                    {this.props.interfaceLang == "hebrew" ? <div className="int-he"><i className="fa fa-chevron-right"></i>משאבים</div> : null }
                  </a>;
    }
    if (this.props.multiPanel) {
      var toggleLang = Sefaria.util.getUrlVars()["lang2"] == "en" ? "he" : "en";
      var langUrl = Sefaria.util.replaceUrlParam("lang2", toggleLang);
      var closeUrl = Sefaria.util.removeUrlParam("with");
      return (<div className="connectionsPanelHeader">
                {title}
                <div className="rightButtons">
                  <LanguageToggleButton toggleLanguage={this.props.toggleLanguage} url={langUrl} />
                  <ReaderNavigationMenuCloseButton icon="circledX" onClick={this.props.closePanel} url={closeUrl} />
                </div>
              </div>);
    } else {
      var style = !this.props.multiPanel && this.props.connectionsMode == "TextList" ? {"borderTopColor": Sefaria.palette.categoryColor(this.props.previousCategory)} : {}
      var cStyle = !this.props.multiPanel && this.props.connectionsMode == "Resources" ? {"justifyContent": "center"} : style;
      // Modeling the class structure when ConnectionsPanelHeader is created inside ReaderControls in the multiPanel case
      var classes = classNames({readerControls: 1, connectionsHeader: 1, fullPanel: this.props.multiPanel});
      return (<div className={classes} style={style}>
                <div className="readerControlsInner">
                  <div className="readerTextToc">
                    <div className="connectionsPanelHeader" style={cStyle}>
                      {title}
                      {!this.props.multiPanel && this.props.previousCategory && this.props.connectionsMode == "TextList" ?
                      <RecentFilterSet
                        srefs={this.props.baseRefs}
                        asHeader={true}
                        filter={this.props.filter}
                        recentFilters={this.props.recentFilters}
                        textCategory={this.props.previousCategory}
                        setFilter={this.props.setFilter} />
                        : null }
                    </div>
                  </div>
                </div>
        </div>);
    }
  }
}

ConnectionsPanelHeader.propTypes = {
    connectionsMode:        PropTypes.string.isRequired, // "Resources", "ConnectionsList", "TextList" etc
    previousCategory:       PropTypes.string,
    multiPanel:             PropTypes.bool,
    filter:                 PropTypes.array,
    recentFilters:          PropTypes.array,
    baseRefs:               PropTypes.array,
    setFilter:              PropTypes.func,
    setConnectionsMode:     PropTypes.func.isRequired,
    setConnectionsCategory: PropTypes.func.isRequired,
    closePanel:             PropTypes.func.isRequired,
    toggleLanguage:         PropTypes.func.isRequired,
    interfaceLang:          PropTypes.string.isRequired
};

class ResourcesList extends Component {
  // A list of Resources in addtion to connections
  render() {
    return (<div className="resourcesList">
              {this.props.multiPanel ?
                <ToolsButton en="Other Text" he="השווה" icon="search" onClick={this.props.openComparePanel} />
              : null }
              <ToolsButton en="Sheets" he="דפי מקורות" image="sheet.svg" count={this.props.sheetsCount} onClick={() => this.props.setConnectionsMode("Sheets")} />
              <ToolsButton en="Notes" he="הרשומות שלי" image="tools-write-note.svg" count={this.props.notesCount} onClick={() => this.props.setConnectionsMode("Notes")} />
              <ToolsButton en="Tools" he="כלים" icon="gear" onClick={() => this.props.setConnectionsMode("Tools")} />
            </div>);
  }
}

ResourcesList.propTypes = {
  multiPanel:         PropTypes.bool.isRequired,
  setConnectionsMode: PropTypes.func.isRequired,
  openComparePanel:   PropTypes.func.isRequired,
  sheetsCount:        PropTypes.number.isRequired,
  notesCount:         PropTypes.number.isRequired,
}


class ConnectionsSummary extends Component {
  // A summary of available connections on `srefs`.
  // If `category` is present, shows a single category, otherwise all categories.
  // If `showBooks`, show specific text counts beneath each category.
  render() {
    var refs    = this.props.srefs;
    var summary = Sefaria.linkSummary(refs);
    var oref    = Sefaria.ref(refs[0]);
    var baseCat = oref ? oref["categories"][0] : null;

    if (!summary) { return (<LoadingMessage />); }

    if (this.props.category == "Commentary" ) {
      // Show Quoting Commentary together with Commentary
      summary = summary.filter(function(cat) { return cat.category == "Commentary" || cat.category == "Quoting Commentary" });

    } else if (this.props.category) {
      // Single Category Summary
      summary = summary.filter(function(cat) { return cat.category == this.props.category; }.bind(this));
      if (summary.length == 0) {
        summary = [{category: this.props.category, books: [], count: 0}];
      }

    } else if (!this.props.category) {
      // Top Level summary, don't show Quoting Commentary
      summary = summary.filter(function(cat) { return cat.category != "Quoting Commentary"; }.bind(this));
    }

    var connectionsSummary = summary.map(function(cat, i) {


      var books = this.props.contentLang == "hebrew"
                    ? cat.books.concat().sort(Sefaria.linkSummaryBookSortHebrew.bind(null, baseCat))
                    : cat.books;
      return (
        <CategoryFilter
          srefs={this.props.srefs}
          category={cat.category}
          heCategory={Sefaria.hebrewTerm(cat.category)}
          showBooks={this.props.showBooks}
          count={cat.count}
          books={books}
          filter={this.props.filter}
          updateRecent={true}
          setFilter={this.props.setFilter}
          setConnectionsCategory={this.props.setConnectionsCategory}
          on={Sefaria.util.inArray(cat.category, this.props.filter) !== -1}
          key={cat.category} />
      );
    }.bind(this));

    return (<div>{connectionsSummary}</div>);
   }
}

ConnectionsSummary.propTypes = {
  srefs:                   PropTypes.array.isRequired, // an array of ref strings
  category:                PropTypes.string, // if present show connections for category, if null show category summary
  filter:                  PropTypes.array,
  fullPanel:               PropTypes.bool,
  multiPanel:              PropTypes.bool,
  contentLang:             PropTypes.string,
  showBooks:               PropTypes.bool,
  setConnectionsMode:      PropTypes.func,
  setFilter:               PropTypes.func,
  setConnectionsCategory:  PropTypes.func.isRequired,
};


class CategoryFilter extends Component {
  // A clickable representation of category of connections, include counts.
  // If `showBooks` list connections broken down by book as well.
  handleClick(e) {
    e.preventDefault();
    if (this.props.showBooks) {
      this.props.setFilter(this.props.category, this.props.updateRecent);
      if (Sefaria.site) { Sefaria.site.track.event("Reader", "Category Filter Click", this.props.category); }
    } else {
      this.props.setConnectionsCategory(this.props.category);
      if (Sefaria.site) { Sefaria.site.track.event("Reader", "Connections Category Click", this.props.category); }
    }
  }
  render() {
    var filterSuffix = this.props.category  == "Quoting Commentary" ? "|Quoting" : null;
    var textFilters = this.props.showBooks ? this.props.books.map(function(book, i) {
     return (<TextFilter
                srefs={this.props.srefs}
                key={i}
                book={book.book}
                heBook={book.heBook}
                count={book.count}
                category={this.props.category}
                hideColors={true}
                updateRecent={true}
                filterSuffix={filterSuffix}
                setFilter={this.props.setFilter}
                on={Sefaria.util.inArray(book.book, this.props.filter) !== -1} />);
    }.bind(this)) : null;

    var color        = Sefaria.palette.categoryColor(this.props.category);
    var style        = {"borderTop": "4px solid " + color};
    var innerClasses = classNames({categoryFilter: 1, withBooks: this.props.showBooks, on: this.props.on});
    var count        = (<span className="enInHe connectionsCount"> ({this.props.count})</span>);
    var handleClick  = this.handleClick;
    var url = (this.props.srefs && this.props.srefs.length > 0)?"/" + Sefaria.normRef(this.props.srefs[0]) + "?with=" + this.props.category:"";
    var innerFilter = (
      <div className={innerClasses} data-name={this.props.category}>
        <span className="en">{this.props.category}{count}</span>
        <span className="he">{this.props.heCategory}{count}</span>
      </div>);
    var wrappedFilter = <a href={url} onClick={handleClick}>{innerFilter}</a>;
    var outerClasses = classNames({categoryFilterGroup: 1, withBooks: this.props.showBooks});
    return (
      <div className={outerClasses} style={style}>
        {wrappedFilter}
        {textFilters}
      </div>
    );
  }
}

CategoryFilter.propTypes = {
  srefs:                  PropTypes.array.isRequired,
  category:               PropTypes.string.isRequired,
  heCategory:             PropTypes.string.isRequired,
  showBooks:              PropTypes.bool.isRequired,
  count:                  PropTypes.number.isRequired,
  books:                  PropTypes.array.isRequired,
  filter:                 PropTypes.array.isRequired,
  updateRecent:           PropTypes.bool.isRequired,
  setFilter:              PropTypes.func.isRequired,
  setConnectionsCategory: PropTypes.func.isRequired,
  on:                     PropTypes.bool,
};


class TextFilter extends Component {
  // A clickable representation of connections by Text or Commentator
  handleClick(e) {
    e.preventDefault();
    var filter = this.props.filterSuffix ? this.props.book + this.props.filterSuffix : this.props.book;
    this.props.setFilter(filter, this.props.updateRecent);
    if (Sefaria.site) {
      if (this.props.inRecentFilters) { Sefaria.site.track.event("Reader", "Text Filter in Recent Click", filter); }
      else { Sefaria.site.track.event("Reader", "Text Filter Click", filter); }
    }
  }
  render() {
    var classes = classNames({textFilter: 1, on: this.props.on, lowlight: this.props.count == 0});

    if (!this.props.hideColors) {
      var color = Sefaria.palette.categoryColor(this.props.category);
      var style = {"borderTop": "4px solid " + color};
    }
    var name = this.props.book == this.props.category ? this.props.book.toUpperCase() : this.props.book;
    var count = this.props.hideCounts || !this.props.count ? "" : ( <span className="enInHe connectionsCount">&nbsp;({this.props.count})</span>);
    var url = (this.props.srefs && this.props.srefs.length > 0)?"/" + Sefaria.normRef(this.props.srefs[0]) + "?with=" + name:"";
    return (
      <a href={url} onClick={this.handleClick}>
        <div data-name={name} className={classes} style={style} >
            <div>
              <span className="en">{name}{count}</span>
              <span className="he">{this.props.heBook}{count}</span>
            </div>
        </div>
      </a>
    );
  }
}

TextFilter.propTypes = {
  srefs:           PropTypes.array.isRequired,
  book:            PropTypes.string.isRequired,
  heBook:          PropTypes.string.isRequired,
  on:              PropTypes.bool.isRequired,
  setFilter:       PropTypes.func.isRequired,
  updateRecent:    PropTypes.bool,
  inRecentFilters: PropTypes.bool,
  filterSuffix:    PropTypes.string,  // Optionally add a string to the filter parameter set (but not displayed)
};

class TextList extends Component {
  constructor(props) {
    super(props);
    this.state = {
      linksLoaded: false, // has the list of refs been loaded
      textLoaded:  false, // has the text of those refs been loaded
      waitForText: true,  // should we delay rendering texts until preload is finished
    }
  }
  componentDidMount() {
    this._isMounted = true;
    this.loadConnections();
  }
  componentWillUnmount() {
    this._isMounted = false;
  }
  componentWillReceiveProps(nextProps) {
    this.preloadText(nextProps.filter);
  }
  componentWillUpdate(nextProps) {
  }
  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.srefs.compare(this.props.srefs)) {
      this.loadConnections();
    }
  }
  getSectionRef() {
    var ref = this.props.srefs[0]; // TODO account for selections spanning sections
    var sectionRef = Sefaria.sectionRef(ref) || ref;
    return sectionRef;
  }
  loadConnections() {
    // Load connections data from server for this section
    var sectionRef = this.getSectionRef();
    if (!sectionRef) { return; }
    Sefaria.related(sectionRef, function(data) {
      if (this._isMounted) {
        this.preloadText(this.props.filter);
        this.setState({
          linksLoaded: true,
        });
      }
    }.bind(this));
  }
  onDataChange() {
    this.setState({linksLoaded: false});
    this.loadConnections();
  }
  preloadText(filter) {
    // Preload text of links if `filter` is a single commentary, or all commentary
    if (filter.length == 1 &&
        Sefaria.index(filter[0]) && // filterSuffix for quoting commmentary prevents this path for QC
        (Sefaria.index(filter[0]).categories[0] == "Commentary"||
         Sefaria.index(filter[0]).primary_category == "Commentary")) {
      // Individual commentator names ("Rashi") are put into Sefaria.index with "Commentary" as first category
      // Intentionally fails when looking up "Rashi on Genesis", which indicates we're looking at a quoting commentary.
      this.preloadSingleCommentaryText(filter);

    } else if (filter.length == 1 && filter[0] == "Commentary") {
      this.preloadAllCommentaryText(filter);

    } else {
      this.setState({waitForText: false, textLoaded: false});
    }
  }
  preloadSingleCommentaryText(filter) {
    // Preload commentary for an entire section of text.
    this.setState({textLoaded: false});
    var commentator       = filter[0];
    var basetext          = this.getSectionRef();
    var commentarySection = Sefaria.commentarySectionRef(commentator, basetext);
    if (!commentarySection) { return; }

    this.setState({waitForText: true});
    Sefaria.text(commentarySection, {}, function() {
      if (this._isMounted) {
        this.setState({textLoaded: true});
      }
    }.bind(this));
  }
  preloadAllCommentaryText() {
    var basetext   = this.getSectionRef();
    var summary    = Sefaria.linkSummary(basetext);
    if (summary.length && summary[0].category == "Commentary") {
      this.setState({textLoaded: false, waitForText: true});
      // Get a list of commentators on this section that we need don't have in the cache
      var links = Sefaria.links(basetext);
      var commentators = summary[0].books.map(function(item) {
        return item.book;
      });

      if (commentators.length) {
        var commentarySections = commentators.map(function(commentator) {
          return Sefaria.commentarySectionRef(commentator, basetext);
        }).filter(function(commentarySection) {
          return !!commentarySection;
        });
        this.waitingFor = Sefaria.util.clone(commentarySections);
        this.target = 0;
        for (var i = 0; i < commentarySections.length; i++) {
          Sefaria.text(commentarySections[i], {}, function(data) {
            var index = this.waitingFor.indexOf(data.commentator);
            if (index == -1) {
                // console.log("Failed to clear commentator:");
                // console.log(data);
                this.target += 1;
            }
            if (index > -1) {
                this.waitingFor.splice(index, 1);
            }
            if (this.waitingFor.length == this.target) {
              if (this._isMounted) {
                this.setState({textLoaded: true});
              }
            }
          }.bind(this));
        }
      } else {
        // All commentaries have been loaded already
        this.setState({textLoaded: true});
      }
    } else {
      // There were no commentaries to load
      this.setState({textLoaded: true});
    }
  }
  getLinks() {
    var refs               = this.props.srefs;
    var filter             = this.props.filter;
    var sectionRef         = this.getSectionRef();

    var sortConnections = function(a, b) {
      if (a.anchorVerse !== b.anchorVerse) {
        return a.anchorVerse - b.anchorVerse;
      }
      if (a.index_title == b.index_title) {
        return a.commentaryNum - b.commentaryNum;
      }
      if (this.props.contentLang == "hebrew") {
        var indexA = Sefaria.index(a.index_title);
        var indexB = Sefaria.index(b.index_title);
        return indexA.heTitle > index.heTitle ? 1 : -1;
      }
      else {
        return a.sourceRef > b.sourceRef ? 1 : -1;
      }
    }.bind(this);

    var sectionLinks = Sefaria.links(sectionRef);
    var links        = Sefaria._filterLinks(sectionLinks, filter);
    links            = links.filter(function(link) {
      if (Sefaria.splitSpanningRef(link.anchorRef).every(aref => Sefaria.util.inArray(aref, refs) === -1)) {
        // Filter out every link in this section which does not overlap with current refs.
        return false;
      }
      return true;
    }.bind(this)).sort(sortConnections);

    return links;
  }
  render() {
    var refs               = this.props.srefs;
    var oref               = Sefaria.ref(refs[0]);
    var filter             = this.props.filter; // Remove filterSuffix for display
    var displayFilter      = filter.map(filter => filter.split("|")[0]);  // Remove filterSuffix for display
    var links              = this.getLinks();

    var en = "No connections known" + (filter.length ? " for " + displayFilter.join(", ") + " here" : "") + ".";
    var he = "אין קשרים ידועים"        + (filter.length ? " ל"    + displayFilter.map(f => Sefaria.hebrewTerm(f)).join(", ") : "") + ".";
    var noResultsMessage = <LoadingMessage message={en} heMessage={he} />;
    var message = !this.state.linksLoaded ? (<LoadingMessage />) : (links.length === 0 ? noResultsMessage : null);
    var content = links.length == 0 ? message :
                  this.state.waitForText && !this.state.textLoaded ?
                    (<LoadingMessage />) :
                    links.map(function(link, i) {
                        var hideTitle = link.category === "Commentary" && this.props.filter[0] !== "Commentary";
                        Sefaria.util.inArray(link.anchorRef, refs) === -1;
                        return (<div className="textListTextRangeBox" key={i + link.sourceRef}>
                                  <TextRange
                                    sref={link.sourceRef}
                                    hideTitle={hideTitle}
                                    numberLabel={link.category === "Commentary" ? link.anchorVerse : 0}
                                    basetext={false}
                                    onRangeClick={this.props.onTextClick}
                                    onCitationClick={this.props.onCitationClick}
                                    onNavigationClick={this.props.onNavigationClick}
                                    onCompareClick={this.props.onCompareClick}
                                    onOpenConnectionsClick={this.props.onOpenConnectionsClick}
                                    inlineReference={link.inline_reference}/>
                                    {Sefaria.is_moderator ?
                                    <ModeratorLinkOptions
                                      _id={link._id}
                                      onDataChange={ this.onDataChange } />
                                    : null}
                                </div>);
                      }, this);
    return (
        <div>
          {this.props.fullPanel ?
          <RecentFilterSet
            srefs={this.props.srefs}
            asHeader={false}
            showText={this.props.showText}
            filter={this.props.filter}
            recentFilters={this.props.recentFilters}
            textCategory={oref ? oref.primary_category : null}
            setFilter={this.props.setFilter}
            showAllFilters={this.showAllFilters} />
            : null }
          { content }
        </div>);
  }
}

TextList.propTypes = {
  srefs:                   PropTypes.array.isRequired,    // an array of ref strings
  filter:                  PropTypes.array.isRequired,
  recentFilters:           PropTypes.array.isRequired,
  fullPanel:               PropTypes.bool,
  multiPanel:              PropTypes.bool,
  contentLang:             PropTypes.string,
  setFilter:               PropTypes.func,
  setConnectionsMode:      PropTypes.func,
  onTextClick:             PropTypes.func,
  onCitationClick:         PropTypes.func,
  onNavigationClick:       PropTypes.func,
  onCompareClick:          PropTypes.func,
  onOpenConnectionsClick:  PropTypes.func,
  onDataChange:            PropTypes.func,
  openNav:                 PropTypes.func,
  openDisplaySettings:     PropTypes.func,
  closePanel:              PropTypes.func,
  selectedWords:           PropTypes.string,
};

class RecentFilterSet extends Component {
  // A toggle-able listing of currently and recently used text filters.
  toggleAllFilterView() {
    this.setState({showAllFilters: !this.state.showAllFilters});
  }
  render() {

    var topLinks = [];

    // Annotate filter texts with category
    var recentFilters = this.props.recentFilters.map(function(filter) {
      var filterAndSuffix = filter.split("|");
      filter              = filterAndSuffix[0];
      var filterSuffix    = filterAndSuffix.length == 2 ? filterAndSuffix[1] : null;
      var index           = Sefaria.index(filter);
      return {
          book: filter,
          filterSuffix: filterSuffix,
          heBook: index ? index.heTitle : Sefaria.hebrewTerm(filter),
          category: index ? index.primary_category : filter };
    });

    // If the current filter is not already in the top set, put it first
    if (this.props.filter.length) {
      var filter = this.props.filter[0];
      for (var i=0; i < topLinks.length; i++) {
        if (recentFilters[i].book == filter ||
            recentFilters[i].category == filter ) { break; }
      }
      if (i == recentFilters.length) {
        var index = Sefaria.index(filter);
        if (index) {
          var annotatedFilter = {book: filter, heBook: index.heTitle, category: index.primary_category };
        } else {
          var annotatedFilter = {book: filter, heBook: filter, category: "Other" };
        }

        recentFilters = [annotatedFilter].concat(topLinks).slice(0,5);
      } else {
        // topLinks.move(i, 0);
      }
    }
    var recentFilters = recentFilters.map(function(book) {
     return (<TextFilter
                srefs={this.props.srefs}
                key={book.book}
                book={book.book}
                heBook={book.heBook}
                category={book.category}
                hideCounts={true}
                hideColors={true}
                count={book.count}
                updateRecent={false}
                inRecentFilters={true}
                filterSuffix={book.filterSuffix}
                setFilter={this.props.setFilter}
                on={Sefaria.util.inArray(book.book, this.props.filter) !== -1} />);
    }.bind(this));

    var classes = classNames({recentFilterSet: 1, topFilters: this.props.asHeader, filterSet: 1});
    return (
      <div className={classes}>
        <div className="topFiltersInner">{recentFilters}</div>
      </div>
    );
  }
}

RecentFilterSet.propTypes = {
  srefs:         PropTypes.array.isRequired,
  filter:        PropTypes.array.isRequired,
  recentFilters: PropTypes.array.isRequired,
  textCategory:  PropTypes.string.isRequired,
  inHeader:      PropTypes.bool,
  setFilter:     PropTypes.func.isRequired,
};

class MySheetsList extends Component {
  // List of my sheets for a ref in the Sidebar
  render() {
    var sheets = Sefaria.sheets.userSheetsByRef(this.props.srefs);
    var content = sheets.length ? sheets.map(function(sheet) {
      return (<SheetListing sheet={sheet} key={sheet.sheetUrl} />)
    }) : null;
    return content && content.length ? (<div className="sheetList">{content}</div>) : null;
  }
}

MySheetsList.propTypes = {
  srefs: PropTypes.array.isRequired,
};


class PublicSheetsList extends Component {
  // List of public sheets for a ref in the sidebar
  render() {
    var sheets = Sefaria.sheets.sheetsByRef(this.props.srefs);
    var content = sheets.length ? sheets.filter(function(sheet) {
      // My sheets are show already in MySheetList
      return sheet.owner !== Sefaria._uid;
    }).map(function(sheet) {
      return (<SheetListing sheet={sheet} key={sheet.sheetUrl} />)
    }) : null;
    return content && content.length ? (<div className="sheetList">{content}</div>) : null;
  }
}

PublicSheetsList.propTypes = {
  srefs: PropTypes.array.isRequired,
};


class SheetListing extends Component {
  // A source sheet listed in the Sidebar
  handleSheetClick() {
    //console.log("Sheet Click Handled");
    if (Sefaria._uid == this.props.sheet.owner) {
      Sefaria.site.track.event("Tools", "My Sheet Click", this.props.sheet.sheetUrl);
    } else {
      Sefaria.site.track.event("Tools", "Sheet Click", this.props.sheet.sheetUrl);
    }
  }
  handleSheetOwnerClick() {
    Sefaria.site.track.event("Tools", "Sheet Owner Click", this.props.sheet.ownerProfileUrl);
  }
  handleSheetTagClick(tag) {
    Sefaria.site.track.event("Tools", "Sheet Tag Click", tag);
  }
  render() {
    var sheet = this.props.sheet;
    var viewsIcon = sheet.public ?
      <div className="sheetViews sans"><i className="fa fa-eye" title={sheet.views + " views"}></i> {sheet.views}</div>
      : <div className="sheetViews sans"><i className="fa fa-lock" title="Private"></i></div>;

    return (
      <div className="sheet" key={sheet.sheetUrl}>
        {viewsIcon}
        <a href={sheet.ownerProfileUrl} target="_blank" onClick={this.handleSheetOwnerClick}>
          <img className="sheetAuthorImg" src={sheet.ownerImageUrl} />
        </a>
        <a href={sheet.ownerProfileUrl} target="_blank" className="sheetAuthor" onClick={this.handleSheetOwnerClick}>{sheet.ownerName}</a>
        <a href={sheet.sheetUrl} target="_blank" className="sheetTitle" onClick={this.handleSheetClick}>
          <img src="/static/img/sheet.svg" className="sheetIcon"/>
          {sheet.title}
        </a>
        <div className="sheetTags">
          {sheet.tags.map(function(tag, i) {
            var separator = i == sheet.tags.length -1 ? null : <span className="separator">,</span>;
            return (<a href={"/sheets/tags/" + tag}
                        target="_blank"
                        className="sheetTag"
                        key={tag}
                        onClick={this.handleSheetTagClick.bind(null, tag)}>{tag}{separator}</a>)
          }.bind(this))}
        </div>
      </div>);
  }
}

SheetListing.propTypes = {
  sheet: PropTypes.object.isRequired,
};

class ModeratorLinkOptions extends Component {
  constructor(props) {
    super(props);
    this.state = {collapsed: false};
  }
  expand() {
    this.setState({collapsed: false});
  }
  deleteLink () {
    if (confirm("Are you sure you want to delete this connection?")) {
      var url = "/api/links/" + this.props._id;
      $.ajax({
        type: "delete",
        url: url,
        success: function() {
          Sefaria.clearLinks();
          this.props.onDataChange();
          alert("Connection deleted.");
        }.bind(this),
        error: function () {
          alert("There was an error deleting this connection. Please reload the page or try again later.");
        }
      });
    }
  }
  render () {
    if (this.state.collapsed) {
      return <div className="moderatorLinkOptions" onClick={this.expand}><i className="fa fa-cog"></i></div>
    }

    return <div className="moderatorLinkOptions sans">
      <div className="moderatorLinkOptionsDelete" onClick={this.deleteLink}>
        <span className="int-en">Remove</span>
        <span className="int-he">מחק</span>
      </div>
    </div>
  }
}

ModeratorLinkOptions.propTypes = {
  _id:          PropTypes.string.isRequired,
  onDataChange: PropTypes.func
};

class LexiconBox extends Component {
  constructor(props) {
    super(props);
    this.state = {
      entries: [],
      loaded: false
    };
  }
  componentDidMount() {
    if(this.props.selectedWords){
      this.getLookups(this.props.selectedWords, this.props.oref);
    }
  }
  componentWillReceiveProps(nextProps) {
    // console.log("component will receive props: ", nextProps.selectedWords);
    if (!nextProps.selectedWords) {
      this.clearLookups();
    } else if (this.props.selectedWords != nextProps.selectedWords) {
      this.clearLookups();
      this.getLookups(nextProps.selectedWords, nextProps.oref);
    }
  }
  clearLookups() {
    this.setState({
      loaded: false,
      entries: []
    });
  }
  getLookups(words, oref) {
    if(this.shouldActivate(words)){
      // console.log('getting data: ', words, oref.ref);
      Sefaria.lexicon(words, oref.ref, function(data) {
        this.setState({
          loaded: true,
          entries: data
        });

        var action = (data.length == 0)? "Open No Result": "Open";
        action += " / " + oref.categories.join("/") + "/" + oref.book;
        Sefaria.site.track.event("Lexicon", action, words);

        // console.log('gotten data from Sefaria.js, state re-set: ', this, data);
      }.bind(this));
    }
  }
  shouldActivate(selectedWords){
    if(!selectedWords){
      return null;
    }
    var wordList = selectedWords.split(/[\s:\u05c3\u05be\u05c0.]+/);
    var inputLength = wordList.length;
    return (inputLength <= 3);
  }
  render() {
    if (!this.props.selectedWords) {
      return (
        <div className="lexicon-instructions">
          <span className="int-en">Highlight words to look up definitions.</span>
          <span className="int-he">סמן מילים כדי לחפש הגדרות</span>
        </div>);
    }

    var refCats = this.props.oref.categories.join(", "); //TODO: the way to filter by categories is very limiting.
    var enEmpty = 'No definitions found for "' + this.props.selectedWords + '".';
    var heEmpty = 'לא נמצאו תוצאות "' + this.props.selectedWords + '".';
    if(!this.shouldActivate(this.props.selectedWords)){
      //console.log("not rendering lexicon");
      return false;
    }
    var content;
    if(!this.state.loaded) {
      // console.log("lexicon not yet loaded");
      content = (<LoadingMessage message="Looking up words..." heMessage="מחפש מילים..."/>);
    } else if(this.state.entries.length == 0) {
      if (this.props.selectedWords.length == 0) {
        //console.log("empty words: nothing to render");
        return false;
      } else {
        //console.log("no results");
        content = (<LoadingMessage message={enEmpty} heMessage={heEmpty}/>);
      }
    }else{
      var entries = this.state.entries;
      content =  entries.filter(e => e['parent_lexicon_details']['text_categories'].length == 0 || e['parent_lexicon_details']['text_categories'].indexOf(refCats) > -1).map(function(entry, i) {
            return (<LexiconEntry data={entry} key={i} />)
          });
      content = content.length ? content : <LoadingMessage message={enEmpty} heMessage={heEmpty} />;
    }
    return (
        <div className="lexicon-content">
          <div className="lexicon-results">
            { content }
          </div>
        </div>
      );
  }
}

LexiconBox.propTypes = {
  selectedWords: PropTypes.string,
  oref:          PropTypes.object
};


class LexiconEntry extends Component {
  renderLexiconEntrySenses(content) {
		var grammar     = ('grammar' in content) ? '('+ content['grammar']['verbal_stem'] + ')' : "";
		var def         = ('definition' in content) ? content['definition'] : "";
    var notes       = ('notes' in content) ? (<span className="notes">{content['notes']}</span>) : "";
    var sensesElems = ('senses' in content) ? content['senses'].map((sense, i) => {
      return <div key={i}>{this.renderLexiconEntrySenses(sense)}</div>;
    }) : "";
    var senses = sensesElems.length ? (<ol className="senses">{sensesElems}</ol>) : "";
    return (
      <li className="sense">
        {grammar}
        {def}
        {notes}
        {senses}
      </li>
    );
  }
  renderLexiconAttribution () {
    var entry = this.props.data;
		var lexicon_dtls = entry['parent_lexicon_details'];
        return (
            <div>
                <span>
                  <a target="_blank"
                      href={('source_url' in lexicon_dtls) ? lexicon_dtls['source_url'] : ""}>
                    <span className="int-en">Source: </span>
                    <span className="int-he">מקור:</span>
                    {'source' in lexicon_dtls ? lexicon_dtls['source'] : lexicon_dtls['source_url']}
                  </a>
                </span>
                <span>
                  <a target="_blank"
                      href={('attribution_url' in lexicon_dtls) ? lexicon_dtls['attribution_url'] : ""}>
                    <span className="int-en">Creator: </span>
                    <span className="int-he">יוצר:</span>
                    {'attribution' in lexicon_dtls ? lexicon_dtls['attribution'] : lexicon_dtls['attribution_url']}
                  </a>
                </span>
            </div>
        );
  }
  render() {
    var entry = this.props.data;
    var headwordClassNames = classNames('headword', entry['parent_lexicon_details']["to_language"].slice(0,2));
    var definitionClassNames = classNames('definition-content', entry['parent_lexicon_details']["to_language"].slice(0,2));
    var entryHeadHtml =  (<span className="headword">{entry['headword']}</span>);
    var morphologyHtml = ('morphology' in entry['content']) ?  (<span className="morphology">({entry['content']['morphology']})</span>) :"";
    var senses = this.renderLexiconEntrySenses(entry['content']);
    var attribution = this.renderLexiconAttribution();
    return (
        <div className="entry">
          <div className={headwordClassNames}>{entryHeadHtml}</div>
          <div className={definitionClassNames}>{morphologyHtml}<ol className="definition">{senses}</ol></div>
          <div className="attribution">{attribution}</div>
        </div>
    );
  }
}

LexiconEntry.propTypes = {
  data: PropTypes.object.isRequired
};

class ToolsList extends Component {
  render() {
    var editText  = this.props.canEditText ? function() {
        var refString = this.props.srefs[0];
        var currentPath = Sefaria.util.currentPath();
        var currentLangParam;
        if (this.props.version) {
          refString += "/" + encodeURIComponent(this.props.versionLanguage) + "/" + encodeURIComponent(this.props.version);
        }
        var path = "/edit/" + refString;
        var nextParam = "?next=" + encodeURIComponent(currentPath);
        path += nextParam;
        Sefaria.site.track.event("Tools", "Edit Text Click", refString,
          {hitCallback: () =>  window.location = path}
        );
    }.bind(this) : null;

    var addTranslation = function() {
      var nextParam = "?next=" + Sefaria.util.currentPath();
      Sefaria.site.track.event("Tools", "Add Translation Click", this.props.srefs[0],
          {hitCallback: () => {window.location = "/translate/" + this.props.srefs[0] + nextParam}}
      );
    }.bind(this);

    return (
      <div>
        <ToolsButton en="Share" he="שתף" image="tools-share.svg" onClick={() => this.props.setConnectionsMode("Share")} />
        <ToolsButton en="Add Translation" he="הוסף תרגום" image="tools-translate.svg" onClick={addTranslation} />
        { Sefaria.is_moderator || Sefaria.is_editor ? <ToolsButton en="Add Connection" he="הוסף קישור לטקסט אחר" image="tools-add-connection.svg"onClick={() => this.props.setConnectionsMode("Add Connection")} /> : null }
        { editText ? (<ToolsButton en="Edit Text" he="ערוך טקסט" image="tools-edit-text.svg" onClick={editText} />) : null }
      </div>);
  }
}

ToolsList.propTypes = {
  srefs:               PropTypes.array.isRequired,  // an array of ref strings
  setConnectionsMode:  PropTypes.func.isRequired,
};


class ToolsButton extends Component {
  onClick(e) {
    e.preventDefault();
    this.props.onClick();
  }
  render() {
    var icon = null;
    if (this.props.icon) {
      var iconName = "fa-" + this.props.icon;
      var classes = {fa: 1, toolsButtonIcon: 1};
      classes[iconName] = 1;
      icon = (<i className={classNames(classes)} />)
    } else if (this.props.image) {
      icon = (<img src={"/static/img/" + this.props.image} className="toolsButtonIcon" alt="" />);
    }

    var count = this.props.count ? (<span className="connectionsCount">({this.props.count})</span>) : null;
    var url = Sefaria.util.replaceUrlParam("with", this.props.en);
    return (
      <a href={url} className="toolsButton sans noselect" onClick={this.onClick}>
        {icon}
        <span className="int-en noselect">{this.props.en} {count}</span>
        <span className="int-he noselect">{this.props.he} {count}</span>
      </a>)
  }
}

ToolsButton.propTypes = {
  en:      PropTypes.string.isRequired,
  he:      PropTypes.string.isRequired,
  icon:    PropTypes.string,
  image:   PropTypes.string,
  count:   PropTypes.number,
  onClick: PropTypes.func
};



class ShareBox extends Component {
  componentDidMount() {
    this.focusInput();
  }
  componentDidUpdate() {
    this.focusInput();
  }
  focusInput() {
    $(ReactDOM.findDOMNode(this)).find("input").select();
  }
  render() {
    var url = this.props.url;

    // Not quite working...
    // var fbButton = <iframe src={"https://www.facebook.com/plugins/share_button.php?href=" + encodeURIComponent(this.props.url) + '&layout=button&size=large&mobile_iframe=true&appId=206308089417064&width=73&height=28'} width="73" height="28" style={{border:"none", overflow: "hidden"}} scrolling="no" frameborder="0" allowTransparency="true"></iframe>

    var shareFacebook = function() {
      openInNewTab("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url));
    };
    var shareTwitter = function() {
      openInNewTab("https://twitter.com/home?status=" + url);
    };
    var shareEmail = function() {
      openInNewTab("mailto:?&subject=Text on Sefaria&body=" + url);
    };
    var classes = classNames({textList: 1, fullPanel: this.props.fullPanel});
    return (
      <div>
        <input className="shareInput" value={this.props.url} />
        <ToolsButton en="Facebook" he="פייסבוק" icon="facebook-official" onClick={shareFacebook} />
        <ToolsButton en="Twitter" he="טוויטר" icon="twitter" onClick={shareTwitter} />
        <ToolsButton en="Email" he="אימייל" icon="envelope-o" onClick={shareEmail} />
      </div>);
  }
}

ShareBox.propTypes = {
  url:                PropTypes.string.isRequired,
  setConnectionsMode: PropTypes.func.isRequired,
  closePanel:         PropTypes.func.isRequired,
  fullPanel:          PropTypes.bool
};

class AddNoteBox extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isPrivate: !props.noteIsPublic,
      saving: false
    };
  }
  componentDidMount() {
    this.focusNoteText();
  }
  focusNoteText() {
    $(ReactDOM.findDOMNode(this)).find(".noteText").focus();
  }
  saveNote() {
    var text = $(ReactDOM.findDOMNode(this)).find(".noteText").val();
    if (!text) { return; }
    var note = {
      text: text,
      refs: this.props.srefs,
      type:  "note",
      public: !this.state.isPrivate
    };
    var postData = { json: JSON.stringify(note) };
    var url = (this.props.noteId ? "/api/notes/" + this.props.noteId : "/api/notes/");
    $.post(url, postData, function(data) {
      if (data.error) {
        alert(data.error);
      } else if (data) {
        if (this.props.noteId) {
          Sefaria.clearPrivateNotes(data);
        } else {
          Sefaria.addPrivateNote(data);
        }
        Sefaria.site.track.event("Tools", "Note Save " + ((this.state.isPrivate)?"Private":"Public"), this.props.srefs.join("/"));
        $(ReactDOM.findDOMNode(this)).find(".noteText").val("");
        this.props.onSave();
      } else {
        alert("Sorry, there was a problem saving your note.");
      }
    }.bind(this)).fail( function(xhr, textStatus, errorThrown) {
      alert("Unfortunately, there was an error saving this note. Please try again or try reloading this page.");
    });
    this.setState({saving: true});
  }
  setPrivate() {
    this.setState({isPrivate: true});
  }
  setPublic() {
    this.setState({isPrivate: false});
  }
  deleteNote() {
    if (!confirm("Are you sure you want to delete this note?")) { return; }
    var url = "/api/notes/" + this.props.noteId;
    $.ajax({
      type: "delete",
      url: url,
      success: function() {
        Sefaria.clearPrivateNotes();
        Sefaria.site.track.event("Tools", "Delete Note", this.props.noteId);
        this.props.onDelete();
      }.bind(this),
      error: function() {
        alert("Something went wrong (that's all I know).");
      }
    });
  }
  render() {
    if (!Sefaria._uid) {
      return (<div className="addNoteBox"><LoginPrompt /></div>);
    }
    var privateClasses = classNames({notePrivateButton: 1, active: this.state.isPrivate});
    var publicClasses  = classNames({notePublicButton: 1, active: !this.state.isPrivate});
    return (
      <div className="addNoteBox">
        <textarea className="noteText" placeholder="Write a note..." defaultValue={this.props.noteText}></textarea>
        <div className="button fillWidth" onClick={this.saveNote}>
          <span className="int-en">{this.props.noteId ? "Save" : "Add Note"}</span>
          <span className="int-he">{this.props.noteId ? "שמור": "הוסף רשומה"}</span>
        </div>
        {this.props.noteId ?
          <div className="button white fillWidth" onClick={this.props.onCancel}>
            <span className="int-en">Cancel</span>
            <span className="int-he">בטל</span>
          </div> : null }
        {this.props.noteId ?
          (<div className="deleteNote" onClick={this.deleteNote}>
            <span className="int-en">Delete Note</span>
            <span className="int-he">מחק רשומה</span>
           </div>): null }
      </div>);

    /* Leaving out public / private toggle until public notes are reintroduced
    <div className="noteSharingToggle">
      <div className={privateClasses} onClick={this.setPrivate}>

        <span className="int-en"><i className="fa fa-lock"></i> Private</span>
        <span className="int-he"><i className="fa fa-lock"></i>רשומה פרטית</span>
      </div>
      <div className={publicClasses} onClick={this.setPublic}>
        <span className="int-en">Public</span>
        <span className="int-he">רשומה כללית</span>
      </div>
    </div>
    */
  }
}

AddNoteBox.propTypes = {
  srefs:          PropTypes.array.isRequired,
  onSave:         PropTypes.func.isRequired,
  onCancel:       PropTypes.func.isRequired,
  onDelete:       PropTypes.func,
  noteId:         PropTypes.string,
  noteText:       PropTypes.string,
  noteTitle:      PropTypes.string,
  noteIsPublic:   PropTypes.bool
};

class MyNotes extends Component {
  componentDidMount() {
    this.loadNotes();
  }
  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.srefs.compare(this.props.srefs)) {
      this.loadNotes();
    }
  }
  loadNotes() {
    // Rerender this component when privateNotes arrive.
    Sefaria.privateNotes(this.props.srefs, this.rerender);
  }
  rerender() {
    this.forceUpdate();
  }
  render() {
    var myNotesData = Sefaria.privateNotes(this.props.srefs);
    var myNotes = myNotesData ? myNotesData.map(function(note) {
      var editNote = function() {
        this.props.editNote(note);
      }.bind(this);
      return (<Note
                text={note.text}
                isPrivate={!note.public}
                isMyNote={true}
                ownerName={note.ownerName}
                ownerProfileUrl={note.ownerProfileUrl}
                ownerImageUrl={note.ownerImageUrl}
                editNote={editNote}
                key={note._id} />);
    }.bind(this)) : null ;

    return myNotes ? (
      <div className="noteList myNoteList">
        {myNotes}
      </div>) : null;
  }
}

MyNotes.propTypes = {
  srefs:    PropTypes.array.isRequired,
  editNote: PropTypes.func.isRequired,
}

class PublicNotes extends Component {
  // List of Publc notes a ref or range or refs.
  render() {
    var notes   = Sefaria.notes(this.props.srefs);
    var content = notes ? notes.filter(function(note) {
      // Exlude my notes, shown already in MyNotes.
      return note.owner !== Sefaria._uid;
    }).map(function(note) {
      return (<Note
                text={note.text}
                ownerName={note.ownerName}
                ownerProfileUrl={note.ownerProfileUrl}
                ownerImageUrl={note.ownerImageUrl}
                isPrivate={false}
                key={note._id} />)
    }) : null;

    return content && content.length ? (<div className="noteList publicNoteList">{content}</div>) : null;
  }
}

PublicNotes.propTypes = {
  srefs: PropTypes.array.isRequired,
};


class AddConnectionBox extends Component {
  constructor(props) {
    super(props);
    this.state = { type: "" };
  }
  setType(type) {
    this.setState({type: type});
  }
  addConnection() {
    var connection = {
      refs: this.props.srefs,
      type: this.state.type,
    };
    var postData = { json: JSON.stringify(connection) };
    var url = "/api/links/";
    $.post(url, postData, function(data) {
      if (data.error) {
        alert(data.error);
      } else {
        Sefaria.site.track.event("Tools", "Add Connection", this.props.srefs.join("/"));
        Sefaria.clearLinks();
        this.props.onSave();
      }
    }.bind(this)).fail( function(xhr, textStatus, errorThrown) {
      alert("Unfortunately, there was an error saving this connection. Please try again or try reloading this page.");
    });
    this.setState({saving: true});
  }
  render() {
    var heRefs = this.props.srefs.map( ref =>  {
      var oRef = Sefaria.ref(ref);
      var heRef = oRef ? oRef.heRef : ref; // If a range was selected, the ref cache may not have a Hebrew ref for us
    });
    return (<div className="addConnectionBox">

            { this.props.srefs.length == 1 ?
              <div>
                <span className="int-en">Choose a text to connect.</span>
                <span className="int-he">בחר טקסט לקישור</span>

                <div className="button fillWidth" onClick={this.props.openComparePanel}>
                  <span className="int-en">Browse</span>
                  <span className="int-he">סייר</span>
                </div>
              </div>
              : null }

            { this.props.srefs.length > 2 ?
              <div>
                <span className="int-en">We currently only understand connections between two texts.</span>
                <span className="int-he">ניתן לקשר רק בין 2 טקסטים</span>
              </div>
              : null }

            { this.props.srefs.length == 2 ?
              <div>

                <div className="addConnectionSummary">
                  <span className="en">{ this.props.srefs[0] }<br/>&<br/>{ this.props.srefs[1]}</span>
                  <span className="he">{ heRefs[0] }<br/>&<br/>{ heRefs[1] }</span>
                </div>

                <Dropdown
                  options={[
                            {value: "",               label: "None"},
                            {value: "commentary",     label: "Commentary"},
                            {value: "quotation",      label: "Quotation"},
                            {value: "midrash",        label: "Midrash"},
                            {value: "ein mishpat",    label: "Ein Mishpat / Ner Mitsvah"},
                            {value: "mesorat hashas", label: "Mesorat HaShas"},
                            {value: "reference",      label: "Reference"},
                            {value: "related",        label: "Related Passage"}
                          ]}
                  placeholder={"Select Type"}
                  onSelect={this.setType} />

                <div className="button fillWidth" onClick={this.addConnection}>
                  <span className="int-en">Add Connection</span>
                  <span className="int-he">הוסף קישור</span>
                </div>

              </div>
              : null }

          </div>);
  }
}

AddConnectionBox.propTypes = {
  srefs:    PropTypes.array.isRequired,
  onSave:   PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

module.exports.ConnectionsPanel = ConnectionsPanel;
module.exports.ConnectionsPanelHeader = ConnectionsPanelHeader;
